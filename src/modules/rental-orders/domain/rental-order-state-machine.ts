import { BadRequestException } from '@nestjs/common';
import { OrderStatus } from '@generated/prisma/enums';
import { RENTAL_ORDER_STATUS_TRANSITION_INVALID } from '@/libs/constants/error.constants';

const transitions: Readonly<Record<OrderStatus, readonly OrderStatus[]>> = {
  [OrderStatus.CREATED]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  [OrderStatus.CONFIRMED]: [OrderStatus.RENTING, OrderStatus.CANCELLED],
  [OrderStatus.RENTING]: [OrderStatus.RETURNED, OrderStatus.DISPUTED],
  [OrderStatus.RETURNED]: [OrderStatus.DONE, OrderStatus.DISPUTED],
  [OrderStatus.DISPUTED]: [OrderStatus.RETURNED, OrderStatus.DONE],
  [OrderStatus.DONE]: [],
  [OrderStatus.CANCELLED]: [],
};

export function assertRentalOrderTransition(from: OrderStatus, to: OrderStatus): void {
  if (!transitions[from]?.includes(to)) {
    throw new BadRequestException(RENTAL_ORDER_STATUS_TRANSITION_INVALID);
  }
}

export function canTransitionRentalOrder(from: OrderStatus, to: OrderStatus): boolean {
  return transitions[from]?.includes(to) ?? false;
}

export function getRentalOrderOverdue(endDate: Date, status: OrderStatus, actualReturnDate: Date | null, now = new Date()) {
  const overdue = status === OrderStatus.RENTING && !actualReturnDate && now.getTime() > endDate.getTime();
  const overdueHours = overdue ? Math.max(0, Math.floor((now.getTime() - endDate.getTime()) / 3_600_000)) : 0;

  return { isOverdue: overdue, overdueHours };
}
