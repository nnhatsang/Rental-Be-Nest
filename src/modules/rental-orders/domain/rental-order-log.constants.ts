/**
 * Các hành động cần xuất hiện trong nhật ký thao tác của đơn thuê.
 *
 * OrderStatusHistory chỉ ghi nhận chuyển trạng thái workflow. Các action ở
 * đây ghi nhận thao tác nghiệp vụ và thay đổi dữ liệu đi kèm, vì vậy không
 * dùng chung hai loại lịch sử này.
 */
export const rentalOrderLogAction = {
  CREATE_ORDER: 'CREATE_ORDER',
  UPDATE_ORDER: 'UPDATE_ORDER',
  DELETE_ORDER: 'DELETE_ORDER',
  CANCEL_ORDER: 'CANCEL_ORDER',
  RECORD_PAYMENT: 'RECORD_PAYMENT',
  CONFIRM_PAYMENT: 'CONFIRM_PAYMENT',
  REJECT_PAYMENT: 'REJECT_PAYMENT',
  CREATE_REFUND: 'CREATE_REFUND',
  CONFIRM_REFUND: 'CONFIRM_REFUND',
  CLOSE_CANCELLED_ORDER: 'CLOSE_CANCELLED_ORDER',
  AUTO_CONFIRM_ORDER: 'AUTO_CONFIRM_ORDER',
  HANDOVER_ORDER: 'HANDOVER_ORDER',
  RETURN_ORDER: 'RETURN_ORDER',
  INSPECT_ORDER: 'INSPECT_ORDER',
  SETTLE_ORDER: 'SETTLE_ORDER',
} as const;

export type RentalOrderLogAction = (typeof rentalOrderLogAction)[keyof typeof rentalOrderLogAction];

export type RentalOrderLogEntity =
  | 'RentalOrder'
  | 'RentalOrderLine'
  | 'PaymentTransaction'
  | 'Refund'
  | 'RentalAssetAllocation'
  | 'RentalInspection';
