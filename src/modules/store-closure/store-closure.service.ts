import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateStoreClosureDto } from './dto/create-store-closure.dto';
import { UpdateStoreClosureDto } from './dto/update-store-closure.dto';
import { GetAllStoreClosuresDto } from './dto/get-all-store-closures.dto';
import { StoreClosureOutDto } from './dto/store-closure-out.dto';
import { RENTAL_ORDER_STORE_CLOSED, STORE_CLOSURE_NOT_FOUND, STORE_CLOSURE_TIME_INVALID } from '@/libs/constants/error.constants';
import { DeleteStoreClosuresDto } from './dto/delete-store-closures.dto';

type StoreClosureRecord = Awaited<ReturnType<StoreClosureService['findStoreClosureById']>>;
type ExistingStoreClosureRecord = NonNullable<StoreClosureRecord>;

@Injectable()
export class StoreClosureService {
  constructor(private readonly prisma: PrismaService) {}

  async getAllStoreClosures(query: GetAllStoreClosuresDto) {
    const { page, perPage, type, fromDate, toDate, sort, sortBy } = query;
    const skip = (page - 1) * perPage;

    const where = {
      deletedAt: null,
      ...(type && { type }),
      ...(fromDate &&
        toDate && {
          startDate: {
            lt: toDate,
          },
          endDate: {
            gt: fromDate,
          },
        }),
      ...(fromDate &&
        !toDate && {
          endDate: {
            gt: fromDate,
          },
        }),
      ...(!fromDate &&
        toDate && {
          startDate: {
            lt: toDate,
          },
        }),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.storeClosure.findMany({
        where,
        skip,
        take: perPage,
        orderBy: [{ [sortBy]: sort }, { id: 'asc' }],
      }),
      this.prisma.storeClosure.count({ where }),
    ]);

    return {
      items: items.map((storeClosure) => this.toStoreClosureOut(storeClosure)),
      total,
      page,
      perPage,
    };
  }

  async getStoreClosureById(id: string): Promise<StoreClosureOutDto> {
    const storeClosure = await this.findExistingStoreClosureById(id);

    return this.toStoreClosureOut(storeClosure);
  }

  async createStoreClosure(dto: CreateStoreClosureDto, userId: string): Promise<StoreClosureOutDto> {
    this.validateClosureTime(dto.startDate, dto.endDate);

    const storeClosure = await this.prisma.storeClosure.create({
      data: {
        startDate: dto.startDate,
        endDate: dto.endDate,
        type: dto.type,
        reason: dto.reason,
        createdBy: userId,
      },
    });

    return this.toStoreClosureOut(storeClosure);
  }

  async updateStoreClosure(id: string, dto: UpdateStoreClosureDto, userId: string): Promise<StoreClosureOutDto> {
    const existingStoreClosure = await this.findExistingStoreClosureById(id);
    const startDate = dto.startDate ?? existingStoreClosure.startDate;
    const endDate = dto.endDate ?? existingStoreClosure.endDate;

    this.validateClosureTime(startDate, endDate);

    const storeClosure = await this.prisma.storeClosure.update({
      where: { id },
      data: {
        startDate: dto.startDate,
        endDate: dto.endDate,
        type: dto.type,
        reason: dto.reason,
        updatedBy: userId,
      },
    });

    return this.toStoreClosureOut(storeClosure);
  }

  async deleteStoreClosures(dto: DeleteStoreClosuresDto, userId: string): Promise<{ success: true }> {
    const uniqueIds = [...new Set(dto.storeClosureIds)];
    if (uniqueIds.length === 0) {
      return { success: true };
    }

    await this.prisma.storeClosure.updateMany({
      where: { id: { in: uniqueIds } },
      data: {
        deletedAt: new Date(),
        deletedBy: userId,
      },
    });

    return { success: true };
  }

  async assertNoClosureOverlap(startDate: Date, endDate: Date): Promise<void> {
    const overlappingClosure = await this.prisma.storeClosure.findFirst({
      where: {
        deletedAt: null,
        startDate: {
          lt: endDate,
        },
        endDate: {
          gt: startDate,
        },
      },
      select: {
        id: true,
      },
    });

    if (overlappingClosure) {
      throw new BadRequestException(RENTAL_ORDER_STORE_CLOSED);
    }
  }

  private async findExistingStoreClosureById(id: string): Promise<ExistingStoreClosureRecord> {
    const storeClosure = await this.findStoreClosureById(id);

    if (!storeClosure) {
      throw new NotFoundException(STORE_CLOSURE_NOT_FOUND);
    }

    return storeClosure;
  }

  private async findStoreClosureById(id: string) {
    return this.prisma.storeClosure.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    });
  }

  private validateClosureTime(startDate: Date, endDate: Date): void {
    if (startDate >= endDate) {
      throw new BadRequestException(STORE_CLOSURE_TIME_INVALID);
    }
  }

  private toStoreClosureOut(storeClosure: ExistingStoreClosureRecord): StoreClosureOutDto {
    return {
      id: storeClosure.id,
      startDate: storeClosure.startDate,
      endDate: storeClosure.endDate,
      type: storeClosure.type,
      reason: storeClosure.reason,
      createdAt: storeClosure.createdAt,
      updatedAt: storeClosure.updatedAt,
      deletedAt: storeClosure.deletedAt,
    };
  }
}
