import { RentalAllocationStatus } from '@generated/prisma/enums';

export const BLOCKING_ALLOCATION_STATUSES: RentalAllocationStatus[] = [
  RentalAllocationStatus.REQUESTED,
  RentalAllocationStatus.RESERVED,
  RentalAllocationStatus.HANDED_OVER,
  RentalAllocationStatus.RETURNED,
];
