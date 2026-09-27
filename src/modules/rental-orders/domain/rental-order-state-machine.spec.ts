import { OrderStatus } from '@generated/prisma/enums';
import { canTransitionRentalOrder, getRentalOrderOverdue } from './rental-order-state-machine';

describe('rental order state machine', () => {
  it('allows only the canonical lifecycle transitions', () => {
    expect(canTransitionRentalOrder(OrderStatus.CREATED, OrderStatus.CONFIRMED)).toBe(true);
    expect(canTransitionRentalOrder(OrderStatus.CONFIRMED, OrderStatus.RENTING)).toBe(true);
    expect(canTransitionRentalOrder(OrderStatus.CREATED, OrderStatus.RENTING)).toBe(false);
    expect(canTransitionRentalOrder(OrderStatus.RETURNED, OrderStatus.DONE)).toBe(true);
  });

  it('computes overdue without changing the persisted main status', () => {
    const overdue = getRentalOrderOverdue(new Date('2026-09-25T08:00:00Z'), OrderStatus.RENTING, null, new Date('2026-09-25T10:30:00Z'));

    expect(overdue).toEqual({ isOverdue: true, overdueHours: 2 });
  });
});
