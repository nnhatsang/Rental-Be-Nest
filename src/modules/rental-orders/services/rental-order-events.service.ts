import { Injectable } from '@nestjs/common';
import { Prisma } from '@generated/prisma/client';
import { OrderStatus } from '@generated/prisma/enums';

@Injectable()
export class RentalOrderEventsService {
  async appendStatusHistory(
    tx: Prisma.TransactionClient,
    params: {
      orderId: string;
      fromStatus: OrderStatus | null;
      toStatus: OrderStatus;
      createdBy: string;
      note?: string | null;
    },
  ): Promise<void> {
    await tx.orderStatusHistory.create({
      data: {
        orderId: params.orderId,
        fromStatus: params.fromStatus,
        toStatus: params.toStatus,
        createdBy: params.createdBy,
        note: params.note,
      },
    });
  }

  async appendStatusChange(
    tx: Prisma.TransactionClient,
    params: {
      orderId: string;
      fromStatus: OrderStatus | null;
      toStatus: OrderStatus;
      createdBy: string;
      note?: string | null;
      metadata?: Prisma.InputJsonValue;
    },
  ): Promise<void> {
    await this.appendStatusHistory(tx, {
      orderId: params.orderId,
      fromStatus: params.fromStatus,
      toStatus: params.toStatus,
      createdBy: params.createdBy,
      note: params.note,
    });
  }
}
