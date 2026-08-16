# Rental Orders Refactor Plan

> Plan viet lai module rental-orders theo tung phase nho. Muc tieu la giam roi nghiep vu tien coc, giu lich, hoan tien, phi phat va dong bo lai database, service, API, response DTO.

## Nguyen Tac Chot

- `RentalOrder` la hop dong thue va giu tong tien de query nhanh.
- `RentalOrderItem` la tung thiet bi/serial trong don, co snapshot rieng.
- `AssetReservation` chi block lich cho item con hieu luc.
- `PaymentRecord` chi ghi tien khach tra cho shop.
- `Refund` ghi tien shop hoan lai cho khach.
- `OrderAdjustment` giai thich cac khoan phi/giam phat sinh.
- `PaymentStatus` khong chua refund nua.
- Khong dung `upfrontTotal`, khong dung `remainingTotal`.

## Glossary Tien

```txt
rentalFeeTotal
= Tong tien thue goc shop giu lai.

depositTotal
= Tong tien khach phai nop de duoc thue thiet bi.
= Bao gom tien thue + phan coc co the hoan.

bookingHoldTotal
= So tien shop yeu cau khach tra truoc de giu lich.
= Nam trong depositTotal, khong phai tien cong them.

paidTotal
= Tong tien khach da tra thanh cong cho shop.

amountDueNow
= So tien can thu ngay tai thoi diem hien tai.

amountDueAtHandover
= So tien can thu them truoc/khi ban giao may.

chargeTotal
= Tong tien shop se giu lai sau phi/giam.
= rentalFeeTotal + lateFeeTotal + damageFeeTotal + compensationFeeTotal + deliveryFeeTotal - discountTotal.

estimatedRefundTotal
= So tien du kien hoan sau khi tinh chargeTotal.

actualRefundTotal
= So tien da thuc su hoan qua bang Refund.
```

## Phase 0 - Dong Bang Scope

Muc tieu: chot lai flow de refactor khong bi truot scope.

Quyet dinh nghiep vu:

- Bo `assignedToId` neu chua can phan cong nhan vien xu ly don.
- Bo `OVERPAID`.
- Tach `refundStatus` rieng khoi `paymentStatus`.
- Giu `ReturnInspection`.
- Giu `OrderHandover` ban don gian, chua them `OrderHandoverItem`.
- Doi/thay doi item truoc khi nhan hang phai dong bo `AssetReservation`.
- Khong can API quote/recalculate rieng; pricing tu tinh lai trong cac action thay doi don.

Checklist:

- [x] Xac nhan FE chap nhan response moi.
- [x] Xac nhan khong can `assignedToId`.
- [x] Xac nhan migration co the lam breaking change.
- [x] Xac nhan co can migrate data cu hay co the reset dev DB.

## Phase 1 - Prisma Schema: Enums

Muc tieu: lam sach status tien va them status can thiet.

Sua `PaymentStatus`:

```prisma
enum PaymentStatus {
  UNPAID
  PARTIALLY_PAID
  PAID
}
```

Them `RefundStatus`:

```prisma
enum RefundStatus {
  NOT_REQUIRED
  PENDING
  PARTIALLY_REFUNDED
  REFUNDED
  FAILED
}
```

Sua `PaymentKind`:

```prisma
enum PaymentKind {
  BOOKING_HOLD
  HANDOVER_PAYMENT
  ADDITIONAL_CHARGE
  OTHER
}
```

Them `OrderItemStatus`:

```prisma
enum OrderItemStatus {
  ACTIVE
  REPLACED
  CANCELLED
  RETURNED
  LOST
  DAMAGED
}
```

Them `OrderAdjustmentType`:

```prisma
enum OrderAdjustmentType {
  LATE_FEE
  DAMAGE_FEE
  DISCOUNT
  COUPON_DISCOUNT
  DELIVERY_FEE
  NEXT_BOOKING_COMPENSATION
  MANUAL_ADJUSTMENT
}
```

Checklist:

- [x] Remove `PARTIALLY_REFUNDED`, `REFUNDED` khoi `PaymentStatus`.
- [x] Remove `REFUND` khoi `PaymentKind`.
- [x] Update imports enum trong code.
- [x] Generate Prisma client thanh cong.

## Phase 2 - Prisma Schema: RentalOrder

Muc tieu: dat lai field tien cho ro nghia.

Giu:

```txt
id
code
source
status
paymentStatus
rentalPolicyId
customerId
customerNameSnapshot
customerPhoneSnapshot
customerEmailSnapshot
customerAddressSnapshot
customerIdentitySnapshot
startDate
endDate
turnaroundMinutes
blockedEndDate
actualPickupDate
actualReturnDate
pickupMethod
deliveryAddress
deliveryFeeTotal
lateFeeTotal
damageFeeTotal
discountTotal
bookingHoldTotal
paidTotal
note
internalNote
cancelReason
searchText
createdAt
updatedAt
deletedAt
createdBy
updatedBy
deletedBy
```

Them:

```prisma
refundStatus          RefundStatus @default(NOT_REQUIRED)
policySnapshot        Json?
rentalFeeTotal        Decimal @default(0) @db.Decimal(12, 2)
compensationFeeTotal  Decimal @default(0) @db.Decimal(12, 2)
chargeTotal           Decimal @default(0) @db.Decimal(12, 2)
amountDueNow          Decimal @default(0) @db.Decimal(12, 2)
amountDueAtHandover   Decimal @default(0) @db.Decimal(12, 2)
estimatedRefundTotal  Decimal @default(0) @db.Decimal(12, 2)
actualRefundTotal     Decimal @default(0) @db.Decimal(12, 2)
```

Bo hoac rename:

```txt
subtotal -> rentalFeeTotal
handoverDueTotal -> amountDueAtHandover
refundTotal -> estimatedRefundTotal
upfrontTotal -> remove
remainingTotal -> remove
assignedToId -> remove neu chua can
```

Checklist:

- [x] DB co `refundStatus`.
- [x] DB khong con `upfrontTotal`.
- [x] DB khong con `remainingTotal`.
- [x] Response khong con `subtotal`, doi sang `rentalFeeTotal`.
- [x] Search/filter khong phu thuoc `assignedToId` neu da bo.

## Phase 3 - Prisma Schema: RentalOrderItem Va AssetReservation

Muc tieu: ho tro doi may/doi serial co audit.

Sua `RentalOrderItem`:

```prisma
serialNumberSnapshot       String
itemStatus                 OrderItemStatus @default(ACTIVE)
replacedByItemId           String? @db.Uuid
replaceReason              String?
hourlyOveragePriceSnapshot Decimal? @db.Decimal(12, 2)
rentalDays                 Int?
```

Bo:

```txt
upfrontAmount
```

Rule dong bo `AssetReservation`:

```txt
ACTIVE item + order blocking status -> reservation RESERVED/CHECKED_OUT
REPLACED item -> reservation CANCELLED/RELEASED
CANCELLED item -> reservation CANCELLED/RELEASED
RETURNED item -> reservation RETURNED/RELEASED tuy theo enum hien co
```

Khi doi may:

```txt
1. Check asset moi co san khong.
2. Set item cu = REPLACED.
3. Cancel reservation cua item cu.
4. Tao item moi = ACTIVE.
5. Tao reservation moi neu order dang block lich.
6. Recalculate totals.
7. Ghi OrderEvent.
```

Checklist:

- [ ] Item cu khong bi hard delete khi replace.
- [ ] Availability khong tinh item `REPLACED/CANCELLED`.
- [ ] Reservation cu duoc cancel/release.
- [ ] Reservation moi duoc tao neu order da `CONFIRMED` tro len.

## Phase 4 - Prisma Schema: Refund

Muc tieu: tach tien hoan khoi payment.

Them model:

```prisma
model Refund {
  id            String       @id @default(uuid(7)) @db.Uuid
  orderId       String       @db.Uuid
  amount        Decimal      @db.Decimal(12, 2)
  status        RefundStatus @default(PENDING)
  method        PaymentMethod
  reason        String?
  referenceCode String?
  note          String?
  processedAt   DateTime?
  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt
  deletedAt     DateTime?
  createdBy     String       @map("created_by") @db.Uuid
  updatedBy     String?      @map("updated_by") @db.Uuid
  deletedBy     String?      @map("deleted_by") @db.Uuid
  order         RentalOrder  @relation(fields: [orderId], references: [id], onDelete: Cascade)

  @@index([orderId])
  @@index([status])
  @@index([createdAt])
}
```

Checklist:

- [ ] `PaymentRecord` khong con `kind = REFUND`.
- [ ] Refund thanh cong tang `actualRefundTotal`.
- [ ] Refund pending cap nhat `refundStatus = PENDING`.
- [ ] Refund thanh cong du tien cap nhat `refundStatus = REFUNDED`.

## Phase 5 - Prisma Schema: OrderAdjustment

Muc tieu: giai thich late fee, damage fee, discount, coupon, compensation.

Them model:

```prisma
model OrderAdjustment {
  id          String              @id @default(uuid(7)) @db.Uuid
  orderId     String              @db.Uuid
  orderItemId String?             @db.Uuid
  type        OrderAdjustmentType
  amount      Decimal             @db.Decimal(12, 2)
  reason      String?
  note        String?
  createdAt   DateTime            @default(now())
  updatedAt   DateTime            @updatedAt
  deletedAt   DateTime?
  createdBy   String              @map("created_by") @db.Uuid
  updatedBy   String?             @map("updated_by") @db.Uuid
  deletedBy   String?             @map("deleted_by") @db.Uuid
  order       RentalOrder         @relation(fields: [orderId], references: [id], onDelete: Cascade)
  orderItem   RentalOrderItem?    @relation(fields: [orderItemId], references: [id])

  @@index([orderId])
  @@index([orderItemId])
  @@index([type])
}
```

Rule tinh tong:

```txt
lateFeeTotal = sum(LATE_FEE)
damageFeeTotal = sum(DAMAGE_FEE)
discountTotal = sum(DISCOUNT + COUPON_DISCOUNT)
compensationFeeTotal = sum(NEXT_BOOKING_COMPENSATION)
chargeTotal = rentalFeeTotal + lateFeeTotal + damageFeeTotal + compensationFeeTotal + deliveryFeeTotal - discountTotal
estimatedRefundTotal = max(depositTotal - chargeTotal, 0)
amountDueNow = max(chargeTotal - paidTotal, 0) sau return/inspection
```

Checklist:

- [ ] Them/sua/xoa adjustment deu recalculate totals.
- [ ] Discount khong lam `chargeTotal` am.
- [ ] Adjustment co the gan `orderItemId` neu phi thuoc may cu the.

## Phase 6 - Service Boundary

Muc tieu: tach logic de module de doc hon.

Can co:

```txt
RentalOrdersService
RentalOrderItemsService
RentalOrderPricingService
RentalOrderAvailabilityService
RentalOrderPaymentsService
RentalOrderRefundsService
RentalOrderAdjustmentsService
RentalOrderHandoversService
RentalOrderReturnsService
RentalOrderWorkflowService
RentalOrderEventsService
RentalOrderMapperService
```

Pham vi:

```txt
RentalOrdersService
= create, list, detail, update thong tin order co ban.

RentalOrderItemsService
= add item, update note, cancel item, replace item, snapshot item.

RentalOrderPricingService
= price items, calculate totals, calculate late fee, recalculate order totals.

RentalOrderAvailabilityService
= check overlap, calculate blockedEndDate, sync reservations.

RentalOrderPaymentsService
= create payment, confirm/reject payment, update paidTotal/paymentStatus.

RentalOrderRefundsService
= create refund, confirm/fail refund, update actualRefundTotal/refundStatus.

RentalOrderAdjustmentsService
= create/update/delete adjustment va trigger recalculate totals.

RentalOrderHandoversService
= outbound handover, start renting.

RentalOrderReturnsService
= mark returned, create/complete inspection, calculate late/damage/refund.

RentalOrderWorkflowService
= validate transition order status.

RentalOrderMapperService
= map Prisma payload sang response DTO.
```

Checklist:

- [ ] `rental-orders.service.ts` khong con om pricing/payment/return logic qua nhieu.
- [ ] Moi action ghi event.
- [ ] Moi action tien goi recalculate chung.
- [ ] Moi action item/date goi availability + sync reservation.

## Phase 7 - API Contract

Muc tieu: API du dung, khong qua vuon.

Orders:

```txt
POST   /rental-orders
GET    /rental-orders
GET    /rental-orders/:id
PATCH  /rental-orders/:id
DELETE /rental-orders/:id
```

Items:

```txt
POST   /rental-orders/:id/items
PATCH  /rental-orders/:id/items/:itemId
DELETE /rental-orders/:id/items/:itemId
POST   /rental-orders/:id/items/:itemId/replace
```

Ghi chu:

- `PATCH item` chi sua note hoac field nho.
- `DELETE item` nen la soft cancel, khong hard delete, va chi cho truoc `RENTING`.
- `replace item` dung khi doi may/doi serial, de giu audit.

Workflow:

```txt
POST /rental-orders/:id/submit-payment
POST /rental-orders/:id/confirm
POST /rental-orders/:id/prepare
POST /rental-orders/:id/ready-for-pickup
POST /rental-orders/:id/start-renting
POST /rental-orders/:id/mark-overdue
POST /rental-orders/:id/cancel
POST /rental-orders/:id/complete
POST /rental-orders/:id/dispute
```

Payments:

```txt
GET  /rental-orders/:id/payments
POST /rental-orders/:id/payments
POST /rental-orders/:id/payments/:paymentId/confirm
POST /rental-orders/:id/payments/:paymentId/reject
```

Adjustments:

```txt
GET    /rental-orders/:id/adjustments
POST   /rental-orders/:id/adjustments
PATCH  /rental-orders/:id/adjustments/:adjustmentId
DELETE /rental-orders/:id/adjustments/:adjustmentId
```

Returns:

```txt
POST /rental-orders/:id/return
POST /rental-orders/:id/return-inspections
POST /rental-orders/:id/return-inspections/:inspectionId/complete
```

Refunds:

```txt
GET  /rental-orders/:id/refunds
POST /rental-orders/:id/refunds
POST /rental-orders/:id/refunds/:refundId/confirm
POST /rental-orders/:id/refunds/:refundId/fail
```

Availability:

```txt
GET  /rental-orders/availability/assets
POST /rental-orders/availability/check
```

Checklist:

- [ ] Khong them `/quote` neu FE khong can.
- [ ] Khong them `/recalculate` public; recalculate noi bo.
- [ ] Item replace/cancel chi cho truoc `RENTING`.
- [ ] Change rental period chi cho truoc `RENTING` va phai check availability.

## Phase 8 - Response DTO Moi

Muc tieu: detail response day du nhung ro nhom.

```json
{
  "id": "...",
  "code": "ORD-000003",
  "status": "CONFIRMED",
  "paymentStatus": "PARTIALLY_PAID",
  "refundStatus": "NOT_REQUIRED",
  "customer": {
    "id": "...",
    "nameSnapshot": "...",
    "phoneSnapshot": "...",
    "emailSnapshot": "...",
    "addressSnapshot": "...",
    "identitySnapshot": "...",
    "socialContactSnapshot": "..."
  },
  "rentalPeriod": {
    "startDate": "...",
    "endDate": "...",
    "turnaroundMinutes": 60,
    "blockedEndDate": "..."
  },
  "pricing": {
    "rentalFeeTotal": "895000",
    "lateFeeTotal": "0",
    "damageFeeTotal": "0",
    "discountTotal": "0",
    "compensationFeeTotal": "0",
    "deliveryFeeTotal": "0",
    "chargeTotal": "895000",
    "depositTotal": "1600000",
    "bookingHoldTotal": "50000",
    "paidTotal": "50000",
    "amountDueNow": "0",
    "amountDueAtHandover": "1550000",
    "estimatedRefundTotal": "705000",
    "actualRefundTotal": "0"
  },
  "items": [],
  "payments": [],
  "refunds": [],
  "adjustments": [],
  "handovers": [],
  "returnInspections": [],
  "statusHistories": [],
  "events": []
}
```

Checklist:

- [ ] Response khong con `upfrontTotal`.
- [ ] Response khong con `remainingTotal`.
- [ ] Response co `refundStatus`.
- [ ] Response co `items[].itemStatus`.
- [ ] Response co `items[].serialNumberSnapshot`.

## Phase 9 - Main Flows

### 9.1 Tao Don Nhap

```txt
POST /rental-orders
status = DRAFT
paymentStatus = UNPAID
refundStatus = NOT_REQUIRED
chua tao reservation
pricing tu tinh
```

Done khi:

- [ ] Tao order thanh cong.
- [ ] Co snapshot customer/item.
- [ ] Khong block lich.
- [ ] Totals dung.

### 9.2 Khach Tra Giu Lich

```txt
POST /payments kind=BOOKING_HOLD
POST /payments/:paymentId/confirm
status -> CONFIRMED
paymentStatus -> PARTIALLY_PAID
tao AssetReservation
```

Done khi:

- [ ] Payment pending -> success.
- [ ] `paidTotal` tang.
- [ ] `amountDueNow` ve 0 neu da tra du booking hold.
- [ ] Reservation duoc tao.

### 9.3 Doi May / Doi Ngay Truoc Khi Nhan

```txt
check availability
replace/cancel item neu can
sync reservation
recalculate totals
ghi event
```

Done khi:

- [ ] Khong cho doi neu da `RENTING`.
- [ ] Item cu giu audit.
- [ ] Reservation cu khong con block lich.
- [ ] Item moi block lich dung.

### 9.4 Ban Giao Va Bat Dau Thue

```txt
yeu cau paidTotal >= depositTotal
tao handover OUTBOUND
status -> RENTING
actualPickupDate set
reservation -> CHECKED_OUT
```

Done khi:

- [ ] Khong cho `RENTING` neu chua tra du.
- [ ] Handover duoc ghi.
- [ ] Availability cap nhat.

### 9.5 Tra May Va Kiem Tra

```txt
status -> RETURNED
actualReturnDate set
tinh late fee neu tre
tao ReturnInspection
tao OrderAdjustment neu co phi
recalculate charge/refund/due
```

Done khi:

- [ ] Tra som thi asset co the ranh som sau turnaround moi.
- [ ] Tra tre cap nhat blockedEndDate = actualReturnDate + turnaroundMinutes.
- [ ] Late fee lam tron theo gio.
- [ ] Neu tre lan don sau, tao `NEXT_BOOKING_COMPENSATION`.

### 9.6 Hoan Tien / Thu Them

```txt
neu estimatedRefundTotal > 0 -> refundStatus PENDING
neu amountDueNow > 0 -> can thu them ADDITIONAL_CHARGE
confirm refund -> actualRefundTotal tang
order.status van COMPLETED
```

Done khi:

- [ ] Refund khong ghi vao PaymentRecord.
- [ ] `refundStatus` cap nhat dung.
- [ ] `paymentStatus` khong bi doi thanh REFUNDED.

## Phase 10 - Test Plan

Unit tests:

- [ ] Pricing: 5 ngay tinh dung tier price.
- [ ] Pricing: booking hold nam trong deposit.
- [ ] Pricing: late fee lam tron theo gio.
- [ ] Pricing: qua max hourly overage tinh nhu 1 ngay.
- [ ] Pricing: damage/discount/compensation tinh dung `chargeTotal`.

Integration tests:

- [ ] Create DRAFT khong tao reservation.
- [ ] Confirm booking hold tao reservation.
- [ ] Replace item cancel reservation cu, tao reservation moi.
- [ ] Change rental period check overlap va update reservations.
- [ ] Start renting yeu cau paid du deposit.
- [ ] Return late tao late adjustment.
- [ ] Complete inspection tinh refund.
- [ ] Confirm refund cap nhat `actualRefundTotal/refundStatus`.

Regression checks:

- [ ] `pnpm typecheck`.
- [ ] `pnpm lint`.
- [ ] Prisma generate.
- [ ] Migration apply tren dev DB.

## Thu Tu Lam De Do Ngop

```txt
1. Phase 1-2: sua enum va RentalOrder fields.
2. Phase 3: sua item/reservation audit.
3. Phase 4-5: them Refund va Adjustment.
4. Phase 8: sua response DTO.
5. Phase 6: tach service mapper/pricing/item.
6. Phase 9.1-9.3: create, payment confirm, replace item.
7. Phase 9.4-9.6: handover, return, refund.
8. Phase 10: test va cleanup.
```

## Viec Co The De Sau

- `OrderHandoverItem` checklist tung thiet bi khi giao.
- Coupon engine that su.
- Online payment gateway.
- Cron auto mark `OVERDUE`.
- Advanced dispute workflow.
- Staff assignment neu sau nay can `assignedToId`.
