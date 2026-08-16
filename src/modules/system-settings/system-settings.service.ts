import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { UpdateSystemSettingsDto } from './dto/update-system-settings.dto';
import { SystemSettingsOutDto } from './dto/system-settings-out.dto';
import { SYSTEM_SETTINGS_NOT_FOUND } from '@/libs/constants/error.constants';
import { RedisService } from '@/libs/redis/redis.service';
import { REDIS_KEYS } from '@/libs/redis/redis-key.constant';
import { REDIS_EXPIRE } from '@/libs/redis/constant/prefix.constant';
import { Prisma } from '@generated/prisma/client';

const SYSTEM_SETTINGS_ID = 1;

type CachedSystemSettings = {
  id: number;
  bookingHoldPricePerUnit: string;
  bookingBufferTimeMinutes: number;
  maxRentalTimeDays: number;
  maxLateReturnTimeHours: number;
  createdAt: string;
  updatedAt: string;
};

@Injectable()
export class SystemSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async getSystemSettings(): Promise<SystemSettingsOutDto> {
    const systemSettings = await this.findSystemSettings();

    if (!systemSettings) {
      throw new NotFoundException(SYSTEM_SETTINGS_NOT_FOUND);
    }

    return this.toSystemSettingsOut(systemSettings);
  }

  async updateSystemSettings(dto: UpdateSystemSettingsDto): Promise<SystemSettingsOutDto> {
    const systemSettings = await this.prisma.systemSettings.upsert({
      where: {
        id: SYSTEM_SETTINGS_ID,
      },
      update: {
        bookingHoldPricePerUnit: dto.bookingHoldPricePerUnit,
        bookingBufferTimeMinutes: dto.bookingBufferTimeMinutes,
        maxRentalTimeDays: dto.maxRentalTimeDays,
        maxLateReturnTimeHours: dto.maxLateReturnTimeHours,
      },
      create: {
        id: SYSTEM_SETTINGS_ID,
        bookingHoldPricePerUnit: dto.bookingHoldPricePerUnit ?? 50000,
        bookingBufferTimeMinutes: dto.bookingBufferTimeMinutes ?? 60,
        maxRentalTimeDays: dto.maxRentalTimeDays ?? 30,
        maxLateReturnTimeHours: dto.maxLateReturnTimeHours ?? 6,
      },
    });

    await this.redis.deleteBestEffort(REDIS_KEYS.systemSettings.default());

    return this.toSystemSettingsOut(systemSettings);
  }

  async getDefaultSettingsForOrder() {
    const systemSettings = await this.findSystemSettings();

    if (!systemSettings) {
      throw new NotFoundException(SYSTEM_SETTINGS_NOT_FOUND);
    }

    return systemSettings;
  }

  private async findSystemSettings() {
    const cachedSettings = await this.redis.getOrSetJson<CachedSystemSettings | null>({
      key: REDIS_KEYS.systemSettings.default(),
      ttlSeconds: REDIS_EXPIRE.SYSTEM_SETTINGS_CACHE,
      loader: async () => {
        const systemSettings = await this.prisma.systemSettings.findUnique({
          where: {
            id: SYSTEM_SETTINGS_ID,
          },
        });

        return systemSettings ? this.toCachedSystemSettings(systemSettings) : null;
      },
    });

    return cachedSettings ? this.fromCachedSystemSettings(cachedSettings) : null;
  }

  private toCachedSystemSettings(systemSettings: {
    id: number;
    bookingHoldPricePerUnit: Prisma.Decimal;
    bookingBufferTimeMinutes: number;
    maxRentalTimeDays: number;
    maxLateReturnTimeHours: number;
    createdAt: Date;
    updatedAt: Date;
  }): CachedSystemSettings {
    return {
      id: systemSettings.id,
      bookingHoldPricePerUnit: systemSettings.bookingHoldPricePerUnit.toString(),
      bookingBufferTimeMinutes: systemSettings.bookingBufferTimeMinutes,
      maxRentalTimeDays: systemSettings.maxRentalTimeDays,
      maxLateReturnTimeHours: systemSettings.maxLateReturnTimeHours,
      createdAt: systemSettings.createdAt.toISOString(),
      updatedAt: systemSettings.updatedAt.toISOString(),
    };
  }

  private fromCachedSystemSettings(systemSettings: CachedSystemSettings) {
    return {
      ...systemSettings,
      bookingHoldPricePerUnit: new Prisma.Decimal(systemSettings.bookingHoldPricePerUnit),
      createdAt: new Date(systemSettings.createdAt),
      updatedAt: new Date(systemSettings.updatedAt),
    };
  }

  private toSystemSettingsOut(systemSettings: NonNullable<Awaited<ReturnType<SystemSettingsService['findSystemSettings']>>>): SystemSettingsOutDto {
    return {
      id: systemSettings.id,
      bookingHoldPricePerUnit: systemSettings.bookingHoldPricePerUnit.toString(),
      bookingBufferTimeMinutes: systemSettings.bookingBufferTimeMinutes,
      maxRentalTimeDays: systemSettings.maxRentalTimeDays,
      maxLateReturnTimeHours: systemSettings.maxLateReturnTimeHours,
      createdAt: systemSettings.createdAt,
      updatedAt: systemSettings.updatedAt,
    };
  }
}
