import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { UpdateRentalPolicyDto } from './dto/update-rental-policy.dto';
import { RentalPolicyOutDto } from './dto/rental-policy-out.dto';
import { RENTAL_POLICY_NOT_FOUND } from '@/libs/constants/error.constants';

const DEFAULT_RENTAL_POLICY_CODE = 'DEFAULT';

@Injectable()
export class RentalPolicyService {
  constructor(private readonly prisma: PrismaService) {}

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
        holdPaymentExpiresInMinutes: dto.holdPaymentExpiresInMinutes,
      },
      create: {
        code: DEFAULT_RENTAL_POLICY_CODE,
        name: dto.name ?? 'Default Rental Policy',
        bookingHoldAmountPerUnit: dto.bookingHoldAmountPerUnit ?? 50000,
        turnaroundMinutes: dto.turnaroundMinutes ?? 60,
        holdPaymentExpiresInMinutes: dto.holdPaymentExpiresInMinutes ?? 30,
      },
    });

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
    return this.prisma.rentalPolicy.findUnique({
      where: {
        code: DEFAULT_RENTAL_POLICY_CODE,
      },
    });
  }

  private toRentalPolicyOut(rentalPolicy: NonNullable<Awaited<ReturnType<RentalPolicyService['findDefaultRentalPolicy']>>>): RentalPolicyOutDto {
    return {
      id: rentalPolicy.id,
      code: rentalPolicy.code,
      name: rentalPolicy.name,
      bookingHoldAmountPerUnit: rentalPolicy.bookingHoldAmountPerUnit.toString(),
      turnaroundMinutes: rentalPolicy.turnaroundMinutes,
      holdPaymentExpiresInMinutes: rentalPolicy.holdPaymentExpiresInMinutes,
      createdAt: rentalPolicy.createdAt,
      updatedAt: rentalPolicy.updatedAt,
    };
  }
}
