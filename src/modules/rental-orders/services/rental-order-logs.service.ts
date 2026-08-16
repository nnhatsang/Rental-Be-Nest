import { Prisma } from '@generated/prisma/client';
import { AuthUser } from '@modules/auth/types/auth-user.type';
import { Injectable } from '@nestjs/common';

export const RENTAL_ORDER_LOG_ENTITY = 'RENTAL_ORDER';

export const RentalOrderLogAction = {
  CreateOrder: 'CREATE_ORDER',
  UpdateOrder: 'UPDATE_ORDER',
  RecordPayment: 'RECORD_PAYMENT',
  HandoverOrder: 'HANDOVER_ORDER',
  CompleteOrder: 'COMPLETE_ORDER',
  RefundOrder: 'REFUND_ORDER',
  CancelOrder: 'CANCEL_ORDER',
  DeleteOrder: 'DELETE_ORDER',
} as const;

export type RentalOrderLogAction = (typeof RentalOrderLogAction)[keyof typeof RentalOrderLogAction];

export type RentalOrderLogChange = {
  field: string;
  label: string;
  oldValue: unknown;
  newValue: unknown;
};

type AppendRentalOrderLogParams = {
  orderId: string;
  actor?: AuthUser | null;
  actorId?: string | null;
  action: RentalOrderLogAction;
  entity?: string;
  changes?: RentalOrderLogChange[];
  note?: string | null;
  skipIfNoChanges?: boolean;
};

type DiffFieldParams = {
  field: string;
  label: string;
  oldValue: unknown;
  newValue: unknown;
};

@Injectable()
export class RentalOrderLogsService {
  async appendLog(tx: Prisma.TransactionClient, params: AppendRentalOrderLogParams) {
    const changes = params.changes ?? [];

    if (params.skipIfNoChanges && changes.length === 0) {
      return null;
    }

    return tx.rentalOrderLog.create({
      data: {
        orderId: params.orderId,
        actorId: params.actor?.id ?? params.actorId ?? null,
        action: params.action,
        entity: params.entity ?? RENTAL_ORDER_LOG_ENTITY,
        changes: changes as Prisma.InputJsonValue,
        note: params.note,
        actorSnapshot: params.actor ? this.buildActorSnapshot(params.actor) : undefined,
      },
    });
  }

  buildActorSnapshot(actor: AuthUser): Prisma.InputJsonObject {
    return {
      id: actor.id,
      name: actor.fullName,
      email: actor.email,
      phone: actor.phone,
    };
  }

  diffFields(fields: DiffFieldParams[]): RentalOrderLogChange[] {
    return fields
      .map((field) => ({
        field: field.field,
        label: field.label,
        oldValue: this.normalizeComparableValue(field.oldValue),
        newValue: this.normalizeComparableValue(field.newValue),
      }))
      .filter((field) => !this.areValuesEqual(field.oldValue, field.newValue));
  }

  private normalizeComparableValue(value: unknown): unknown {
    if (value instanceof Date) return value.toISOString();
    if (value instanceof Prisma.Decimal) return Number(value);
    if (typeof value === 'bigint') return Number(value);
    if (Array.isArray(value)) return value.map((item) => this.normalizeComparableValue(item));

    if (typeof value === 'object' && value !== null) {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, this.normalizeComparableValue(item)]),
      );
    }

    return value ?? null;
  }

  private areValuesEqual(left: unknown, right: unknown): boolean {
    return JSON.stringify(left) === JSON.stringify(right);
  }
}
