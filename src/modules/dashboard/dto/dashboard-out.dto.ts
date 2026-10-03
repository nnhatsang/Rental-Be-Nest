import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  HandoverStatus,
  OrderStatus,
  RentalSettlementStatus,
  ReturnStatus,
} from '@generated/prisma/enums';
import {
  DashboardAttentionPriority,
  DashboardAttentionType,
  DashboardScheduleType,
  DashboardTrendGroupBy,
} from './get-dashboard.dto';
import { ApiPaginatedResponseDto } from '@/libs/types/custom-response.type';

export class DashboardPeriodOutDto {
  @ApiProperty()
  fromDate!: Date;

  @ApiProperty()
  toDate!: Date;

  @ApiProperty()
  timezone!: string;

  @ApiProperty({ description: 'Các số liệu đang được tính theo khoảng thời gian thuê, không phải ngày tạo giao dịch.' })
  dateBasis!: string;
}

export class DashboardSummaryOutDto {
  @ApiProperty()
  totalOrders!: number;

  @ApiProperty()
  cancelledOrders!: number;

  @ApiProperty()
  attentionOrders!: number;

  @ApiProperty()
  pickupDue!: number;

  @ApiProperty()
  returnDue!: number;

  @ApiProperty()
  overdueReturns!: number;

  @ApiProperty()
  pendingPayments!: number;

  @ApiProperty()
  refundDueOrders!: number;

  @ApiProperty()
  pendingRefundTransactions!: number;
}

export class DashboardFinancialsOutDto {
  @ApiProperty({ description: 'Tổng tiền thuê của các đơn hợp lệ trong kỳ.' })
  rentalRevenue!: number;

  @ApiProperty({ description: 'Tổng phí giao nhận của các đơn hợp lệ trong kỳ.' })
  deliveryRevenue!: number;

  @ApiProperty({ description: 'Tổng tiền đã thu trên snapshot các đơn trong kỳ; không đồng nghĩa với doanh thu.' })
  collectedTotal!: number;

  @ApiProperty({ description: 'Tiền cọc còn ước tính đang giữ trên snapshot các đơn trong kỳ.' })
  depositHeldTotal!: number;

  @ApiProperty()
  amountDueBeforeHandover!: number;

  @ApiProperty()
  refundDueTotal!: number;

  @ApiProperty()
  pendingRefundTotal!: number;

  @ApiProperty({ description: 'Khoản bồi thường hư hỏng đã tính cho khách, không phải chi phí sửa chữa thực tế.' })
  damageCompensationTotal!: number;

  @ApiPropertyOptional({ nullable: true, description: 'Chưa có module ghi nhận chi phí sửa chữa thực tế.' })
  repairCostTotal!: number | null;
}

export class DashboardAvailabilityOutDto {
  @ApiProperty()
  totalAssets!: number;

  @ApiProperty()
  scheduledAssets!: number;

  @ApiProperty()
  freeAssets!: number;

  @ApiProperty()
  unavailableAssets!: number;

  @ApiProperty()
  maintenanceAssets!: number;

  @ApiProperty()
  lostAssets!: number;

  @ApiProperty()
  damagedAssets!: number;
}

export class DashboardTopProductOutDto {
  @ApiProperty({ type: String, format: 'uuid' })
  productId!: string;

  @ApiProperty()
  productName!: string;

  @ApiProperty()
  sku!: string;

  @ApiProperty()
  rentedQuantity!: number;

  @ApiProperty()
  rentalOrderCount!: number;

  @ApiProperty({ description: 'Tổng ngày-thiết bị, bằng số ngày thuê nhân số lượng.' })
  rentalDeviceDays!: number;

  @ApiProperty()
  rentalRevenue!: number;
}

export class DashboardTopAssetOutDto {
  @ApiProperty({ type: String, format: 'uuid' })
  assetUnitId!: string;

  @ApiProperty()
  serialNumber!: string;

  @ApiProperty({ type: String, format: 'uuid' })
  productId!: string;

  @ApiProperty()
  productName!: string;

  @ApiProperty()
  rentalCount!: number;

  @ApiProperty({ description: 'Tổng số ngày máy vật lý đã được bàn giao/thuê trong kỳ.' })
  rentalDeviceDays!: number;
}

export class DashboardAttentionOutDto {
  @ApiProperty({ enum: DashboardAttentionType })
  type!: DashboardAttentionType;

  @ApiProperty({ enum: DashboardAttentionPriority })
  priority!: DashboardAttentionPriority;

  @ApiProperty({ type: String, format: 'uuid' })
  orderId!: string;

  @ApiProperty()
  orderCode!: string;

  @ApiProperty({ enum: OrderStatus })
  orderStatus!: OrderStatus;

  @ApiProperty({ enum: HandoverStatus })
  handoverStatus!: HandoverStatus;

  @ApiProperty({ enum: ReturnStatus })
  returnStatus!: ReturnStatus;

  @ApiProperty({ enum: RentalSettlementStatus })
  settlementStatus!: RentalSettlementStatus;

  @ApiProperty()
  customerName!: string;

  @ApiPropertyOptional({ nullable: true })
  customerPhone!: string | null;

  @ApiProperty()
  productSummary!: string;

  @ApiProperty()
  startDate!: Date;

  @ApiProperty()
  endDate!: Date;

  @ApiPropertyOptional({ nullable: true })
  amount!: number | null;

  @ApiProperty()
  message!: string;
}

export class DashboardScheduleItemOutDto {
  @ApiProperty({ enum: DashboardScheduleType })
  type!: DashboardScheduleType;

  @ApiProperty({ type: String, format: 'uuid' })
  orderId!: string;

  @ApiProperty()
  orderCode!: string;

  @ApiProperty({ enum: OrderStatus })
  orderStatus!: OrderStatus;

  @ApiProperty()
  customerName!: string;

  @ApiProperty()
  productSummary!: string;

  @ApiProperty()
  scheduledAt!: Date;
}

export class DashboardOperationsOverviewOutDto {
  @ApiProperty()
  generatedAt!: Date;

  @ApiProperty({ type: DashboardPeriodOutDto })
  period!: DashboardPeriodOutDto;

  @ApiProperty({ type: DashboardSummaryOutDto })
  summary!: DashboardSummaryOutDto;

  @ApiProperty({ type: DashboardFinancialsOutDto })
  financials!: DashboardFinancialsOutDto;

  @ApiProperty({ type: DashboardAvailabilityOutDto })
  availability!: DashboardAvailabilityOutDto;

  @ApiProperty({ type: [DashboardTopProductOutDto] })
  topProducts!: DashboardTopProductOutDto[];

  @ApiProperty({ type: [DashboardTopAssetOutDto] })
  topAssets!: DashboardTopAssetOutDto[];

  @ApiProperty({ type: [DashboardAttentionOutDto] })
  attentionPreview!: DashboardAttentionOutDto[];

  @ApiProperty({ type: [DashboardScheduleItemOutDto] })
  schedulePreview!: DashboardScheduleItemOutDto[];
}

export class DashboardTrendItemOutDto {
  @ApiProperty({ description: 'Mốc bắt đầu bucket theo timezone của request, định dạng ISO không kèm offset.' })
  bucketStart!: string;

  @ApiProperty()
  orderCount!: number;

  @ApiProperty()
  rentalRevenue!: number;

  @ApiProperty()
  deliveryRevenue!: number;

  @ApiProperty()
  collectedTotal!: number;

  @ApiProperty()
  damageCompensationTotal!: number;
}

export class DashboardTrendsOutDto {
  @ApiProperty({ type: DashboardPeriodOutDto })
  period!: DashboardPeriodOutDto;

  @ApiProperty({ enum: DashboardTrendGroupBy })
  groupBy!: DashboardTrendGroupBy;

  @ApiProperty({ type: [DashboardTrendItemOutDto] })
  items!: DashboardTrendItemOutDto[];
}

export class DashboardAttentionPaginatedResponseDto extends ApiPaginatedResponseDto<DashboardAttentionOutDto> {}

