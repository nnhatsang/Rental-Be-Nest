import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { UpdateRentalPolicyDto } from './dto/update-rental-policy.dto';
import { RentalPolicyOutDto } from './dto/rental-policy-out.dto';
import { RENTAL_POLICY_NOT_FOUND } from '@/libs/constants/error.constants';
import { RedisService } from '@/libs/redis/redis.service';
import { REDIS_KEYS } from '@/libs/redis/redis-key.constant';
import { REDIS_EXPIRE } from '@/libs/redis/constant/prefix.constant';
import { Prisma } from '@generated/prisma/client';

const DEFAULT_RENTAL_POLICY_CODE = 'DEFAULT';

type CachedRentalPolicy = {
  id: string;
  code: string;
  name: string;
  bookingHoldAmountPerUnit: string;
  turnaroundMinutes: number;
  createdAt: string;
  updatedAt: string;
};

@Injectable()
export class RentalPolicyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async getRentalPolicy(): Promise<RentalPolicyOutDto> {
    const rentalPolicy = await this.findDefaultRentalPolicy();

    if (!rentalPolicy) {
      throw new NotFoundException(RENTAL_POLICY_NOT_FOUND);
    }

    return this.toRentalPolicyOut(rentalPolicy);
  }

  async updateRentalPolicy(dto: UpdateRentalPolicyDto): Promise<RentalPolicyOutDto> {
    const rentalPolicy = await this.prisma.rentalPolicy.upsert({
      where: {
        code: DEFAULT_RENTAL_POLICY_CODE,
      },
      update: {
        name: dto.name,
        bookingHoldAmountPerUnit: dto.bookingHoldAmountPerUnit,
        turnaroundMinutes: dto.turnaroundMinutes,
      },
      create: {
        code: DEFAULT_RENTAL_POLICY_CODE,
        name: dto.name ?? 'Default Rental Policy',
        bookingHoldAmountPerUnit: dto.bookingHoldAmountPerUnit ?? 50000,
        turnaroundMinutes: dto.turnaroundMinutes ?? 60,
      },
    });

    await this.redis.deleteBestEffort(REDIS_KEYS.rentalPolicy.default());

    return this.toRentalPolicyOut(rentalPolicy);
  }

  async getDefaultPolicyForOrder() {
    const rentalPolicy = await this.findDefaultRentalPolicy();

    if (!rentalPolicy) {
      throw new NotFoundException(RENTAL_POLICY_NOT_FOUND);
    }

    return rentalPolicy;
  }

  private async findDefaultRentalPolicy() {
    const cachedPolicy = await this.redis.getOrSetJson<CachedRentalPolicy | null>({
      key: REDIS_KEYS.rentalPolicy.default(),
      ttlSeconds: REDIS_EXPIRE.RENTAL_POLICY_CACHE,
      loader: async () => {
        const rentalPolicy = await this.prisma.rentalPolicy.findUnique({
          where: {
            code: DEFAULT_RENTAL_POLICY_CODE,
          },
        });

        return rentalPolicy ? this.toCachedRentalPolicy(rentalPolicy) : null;
      },
    });

    return cachedPolicy ? this.fromCachedRentalPolicy(cachedPolicy) : null;
  }

  private toCachedRentalPolicy(rentalPolicy: {
    id: string;
    code: string;
    name: string;
    bookingHoldAmountPerUnit: Prisma.Decimal;
    turnaroundMinutes: number;
    createdAt: Date;
    updatedAt: Date;
  }): CachedRentalPolicy {
    return {
      id: rentalPolicy.id,
      code: rentalPolicy.code,
      name: rentalPolicy.name,
      bookingHoldAmountPerUnit: rentalPolicy.bookingHoldAmountPerUnit.toString(),
      turnaroundMinutes: rentalPolicy.turnaroundMinutes,
      createdAt: rentalPolicy.createdAt.toISOString(),
      updatedAt: rentalPolicy.updatedAt.toISOString(),
    };
  }

  private fromCachedRentalPolicy(rentalPolicy: CachedRentalPolicy) {
    return {
      ...rentalPolicy,
      bookingHoldAmountPerUnit: new Prisma.Decimal(rentalPolicy.bookingHoldAmountPerUnit),
      createdAt: new Date(rentalPolicy.createdAt),
      updatedAt: new Date(rentalPolicy.updatedAt),
    };
  }

  private toRentalPolicyOut(rentalPolicy: NonNullable<Awaited<ReturnType<RentalPolicyService['findDefaultRentalPolicy']>>>): RentalPolicyOutDto {
    return {
      id: rentalPolicy.id,
      code: rentalPolicy.code,
      name: rentalPolicy.name,
      bookingHoldAmountPerUnit: rentalPolicy.bookingHoldAmountPerUnit.toString(),
      turnaroundMinutes: rentalPolicy.turnaroundMinutes,
      createdAt: rentalPolicy.createdAt,
      updatedAt: rentalPolicy.updatedAt,
    };
  }
}
