import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { UpdateStoreBusinessHoursDto, UpdateStoreBusinessHourItemDto } from './dto/update-store-business-hours.dto';
import { StoreBusinessHourOutDto } from './dto/store-business-hour-out.dto';
import { RENTAL_ORDER_STORE_CLOSED, STORE_BUSINESS_HOURS_INVALID } from '@/libs/constants/error.constants';
import { RedisService } from '@/libs/redis/redis.service';
import { REDIS_KEYS } from '@/libs/redis/redis-key.constant';
import { REDIS_EXPIRE } from '@/libs/redis/constant/prefix.constant';

type CachedStoreBusinessHour = {
  dayOfWeek: number;
  openTime: string;
  closeTime: string;
  isOpen: boolean;
  createdAt: string;
  updatedAt: string;
};

@Injectable()
export class StoreBusinessHoursService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async getStoreBusinessHours(): Promise<StoreBusinessHourOutDto[]> {
    const businessHours = await this.getCachedBusinessHours();

    return businessHours.map((businessHour) => this.toStoreBusinessHourOut(this.fromCachedBusinessHour(businessHour)));
  }

  async updateStoreBusinessHours(dto: UpdateStoreBusinessHoursDto): Promise<StoreBusinessHourOutDto[]> {
    this.validateBusinessHours(dto.items);

    const businessHours = await this.prisma.$transaction(
      dto.items.map((item) =>
        this.prisma.storeBusinessHour.upsert({
          where: {
            dayOfWeek: item.dayOfWeek,
          },
          update: {
            openTime: item.openTime,
            closeTime: item.closeTime,
            isOpen: item.isOpen,
          },
          create: {
            dayOfWeek: item.dayOfWeek,
            openTime: item.openTime,
            closeTime: item.closeTime,
            isOpen: item.isOpen,
          },
        }),
      ),
    );

    await this.redis.deleteBestEffort(REDIS_KEYS.store.businessHours());

    return businessHours.sort((first, second) => first.dayOfWeek - second.dayOfWeek).map((businessHour) => this.toStoreBusinessHourOut(businessHour));
  }

  async assertRentalTimeWithinBusinessHours(startDate: Date, endDate: Date): Promise<void> {
    const businessHours = await this.getCachedBusinessHours();
    const businessHoursByDay = new Map(businessHours.map((businessHour) => [businessHour.dayOfWeek, businessHour]));

    this.assertDateWithinBusinessHours(startDate, businessHoursByDay);
    this.assertDateWithinBusinessHours(endDate, businessHoursByDay);
  }

  private async ensureDefaultBusinessHours(): Promise<void> {
    const existingCount = await this.prisma.storeBusinessHour.count();

    if (existingCount >= 7) {
      return;
    }

    await this.prisma.$transaction(
      this.defaultBusinessHours().map((businessHour) =>
        this.prisma.storeBusinessHour.upsert({
          where: {
            dayOfWeek: businessHour.dayOfWeek,
          },
          update: {},
          create: businessHour,
        }),
      ),
    );

    await this.redis.deleteBestEffort(REDIS_KEYS.store.businessHours());
  }

  private async getCachedBusinessHours(): Promise<CachedStoreBusinessHour[]> {
    return this.redis.getOrSetJson<CachedStoreBusinessHour[]>({
      key: REDIS_KEYS.store.businessHours(),
      ttlSeconds: REDIS_EXPIRE.STORE_BUSINESS_HOURS_CACHE,
      loader: async () => {
        await this.ensureDefaultBusinessHours();

        const businessHours = await this.prisma.storeBusinessHour.findMany({
          orderBy: {
            dayOfWeek: 'asc',
          },
        });

        return businessHours.map((businessHour) => this.toCachedBusinessHour(businessHour));
      },
    });
  }

  private toCachedBusinessHour(businessHour: StoreBusinessHourOutDto): CachedStoreBusinessHour {
    return {
      ...businessHour,
      createdAt: businessHour.createdAt.toISOString(),
      updatedAt: businessHour.updatedAt.toISOString(),
    };
  }

  private fromCachedBusinessHour(businessHour: CachedStoreBusinessHour): StoreBusinessHourOutDto {
    return {
      ...businessHour,
      createdAt: new Date(businessHour.createdAt),
      updatedAt: new Date(businessHour.updatedAt),
    };
  }

  private validateBusinessHours(items: UpdateStoreBusinessHourItemDto[]): void {
    const dayOfWeeks = new Set(items.map((item) => item.dayOfWeek));

    if (dayOfWeeks.size !== 7 || ![0, 1, 2, 3, 4, 5, 6].every((dayOfWeek) => dayOfWeeks.has(dayOfWeek))) {
      throw new BadRequestException(STORE_BUSINESS_HOURS_INVALID);
    }

    for (const item of items) {
      if (item.isOpen && this.toMinutes(item.openTime) >= this.toMinutes(item.closeTime)) {
        throw new BadRequestException(STORE_BUSINESS_HOURS_INVALID);
      }
    }
  }

  private defaultBusinessHours(): UpdateStoreBusinessHourItemDto[] {
    return [
      { dayOfWeek: 0, openTime: '08:00', closeTime: '18:00', isOpen: false },
      { dayOfWeek: 1, openTime: '08:00', closeTime: '20:00', isOpen: true },
      { dayOfWeek: 2, openTime: '08:00', closeTime: '20:00', isOpen: true },
      { dayOfWeek: 3, openTime: '08:00', closeTime: '20:00', isOpen: true },
      { dayOfWeek: 4, openTime: '08:00', closeTime: '20:00', isOpen: true },
      { dayOfWeek: 5, openTime: '08:00', closeTime: '20:00', isOpen: true },
      { dayOfWeek: 6, openTime: '08:00', closeTime: '18:00', isOpen: true },
    ];
  }

  private toMinutes(time: string): number {
    const [hour, minute] = time.split(':').map(Number);
    return hour * 60 + minute;
  }

  private assertDateWithinBusinessHours(
    date: Date,
    businessHoursByDay: Map<number, { dayOfWeek: number; openTime: string; closeTime: string; isOpen: boolean }>,
  ): void {
    const dayOfWeek = date.getDay();
    const businessHour = businessHoursByDay.get(dayOfWeek);
    const dateMinutes = date.getHours() * 60 + date.getMinutes();

    if (!businessHour?.isOpen) {
      throw new BadRequestException(RENTAL_ORDER_STORE_CLOSED);
    }

    const openMinutes = this.toMinutes(businessHour.openTime);
    const closeMinutes = this.toMinutes(businessHour.closeTime);

    if (dateMinutes < openMinutes || dateMinutes > closeMinutes) {
      throw new BadRequestException(RENTAL_ORDER_STORE_CLOSED);
    }
  }

  private toStoreBusinessHourOut(businessHour: StoreBusinessHourOutDto): StoreBusinessHourOutDto {
    return {
      dayOfWeek: businessHour.dayOfWeek,
      openTime: businessHour.openTime,
      closeTime: businessHour.closeTime,
      isOpen: businessHour.isOpen,
      createdAt: businessHour.createdAt,
      updatedAt: businessHour.updatedAt,
    };
  }
}
