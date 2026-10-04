# Rental Order Audit Log Plan

> Ghi chu quyet dinh thiet ke `RentalOrderLog` de theo doi ai da thay doi don thue, thay doi gi, va vi sao. Tai lieu nay dung lam note trien khai backend Prisma/service/API va frontend tab Lich su.

## Muc Tieu

`RentalOrderLog` tra loi cau hoi:

```txt
Ai da thao tac?
Thao tac vao luc nao?
Thao tac tren API/flow nao?
Field nao doi tu gia tri cu sang gia tri moi?
Co ghi chu nghiep vu kem theo khong?
```

Khong dung `RentalOrderLog` de thay the:

- `statusHistories`: chi ghi chuyen trang thai don.
- `payments`: chi ghi dong tien thu/hoan.

## Trang thai hien tai

`RentalOrderLog` da co trong Prisma schema, migration va relation `RentalOrder.logs`. Backend hien include log trong detail response voi ten `activityLogs` va ghi log trong cung transaction voi cac mutation rental-order chinh.

`OrderStatusHistory` van la nguon cho lich su chuyen `OrderStatus`. `RentalOrderLog` chi ghi audit chi tiet nhu thay doi snapshot, thoi gian, san pham, tai chinh, actor va ly do. Hai bang khong thay the nhau.

Voi flow huy/hoan tien, cac action dang duoc audit gom `CANCEL_ORDER`, `CREATE_REFUND`, `CONFIRM_REFUND` va `CLOSE_CANCELLED_ORDER`.

## Prisma Model De Xuat

Ten bang thong nhat la `RentalOrderLog`.

```prisma
model RentalOrderLog {
  id            String      @id @default(uuid(7)) @db.Uuid
  orderId       String      @db.Uuid
  actorId       String?     @db.Uuid
  action        String
  entity        String
  changes       Json
  note          String?
  actorSnapshot Json?
  createdAt     DateTime    @default(now())

  order         RentalOrder @relation(fields: [orderId], references: [id], onDelete: Cascade)

  @@index([orderId])
  @@index([actorId])
  @@index([action])
  @@index([createdAt])
}
```

Neu can relation nguoc trong `RentalOrder`:

```prisma
logs RentalOrderLog[]
```

## Shape Cua changes

`changes` la JSON object co envelope `version: 1`, chi luu thong tin can thiet cho thao tac. Khong luu full order snapshot neu khong can.

```json
{
  "version": 1,
  "changedFields": ["customerSnapshot.phone", "rentalPeriod.endDate"],
  "summary": "Cap nhat thong tin lien he va thoi gian thue"
}
```

`actorSnapshot` nen luu thong tin hien thi tai thoi diem thao tac:

```json
{
  "id": "019fe-user-001",
  "name": "Nguyen Admin",
  "email": "admin@example.com"
}
```

## API/Flow Can Ghi Log

Phase 1 ghi log cho cac endpoint chinh:

```txt
POST   /rental-orders
PATCH  /rental-orders/:id
POST   /rental-orders/:id/payments
POST   /rental-orders/:id/handover
POST   /rental-orders/:id/return
POST   /rental-orders/:id/inspections
POST   /rental-orders/:id/settle
POST   /rental-orders/:id/refunds
POST   /rental-orders/:id/cancel
POST   /rental-orders/:id/close-cancellation
DELETE /rental-orders
```

Action de xuat:

```txt
CREATE_ORDER
UPDATE_ORDER
RECORD_PAYMENT
CONFIRM_PAYMENT
REJECT_PAYMENT
HANDOVER_ORDER
RETURN_ORDER
INSPECT_ORDER
SETTLE_ORDER
CREATE_REFUND
CONFIRM_REFUND
CANCEL_ORDER
AUTO_CONFIRM_ORDER
CLOSE_CANCELLED_ORDER
DELETE_ORDER
```

## Performance Decision

Phase 1 ghi audit log dong bo trong cung transaction voi action chinh.

Pattern:

```txt
1. Validate business rule.
2. Update/create du lieu chinh.
3. Tao payment/status history neu co.
4. Tao RentalOrderLog.
5. Commit transaction.
```

Ly do chon sync transaction:

- Dam bao action thanh cong thi log chac chan ton tai.
- Neu action rollback thi log cung rollback.
- Audit log la du lieu doi soat/nghiep vu, khong nen co rui ro mat log do worker/queue loi.
- Volume thao tac admin rental du kien khong lon den muc can queue ngay.

Khong nen dua audit log cot loi vao queue trong phase 1.

Queue chi can can nhac o phase 2 neu co:

- Gui notification/email/webhook.
- Dong bo log sang he thong ngoai.
- Luu snapshot lon hoac log co payload rat nang.
- Traffic thao tac lon va write log tro thanh bottleneck that su.

## Toi Uu Query Va Luu Tru

Can toi uu bang cach:

- Chi luu diff fields trong `changes`.
- Khong luu full order detail moi lan update.
- Index `orderId`, `createdAt`, `action`, `actorId`.
- Detail response phase 1 tra toan bo log theo `createdAt ASC`. Neu volume thuc te tang,
  giu hop dong `activityLogs` hien tai va tach endpoint cursor o phase sau; khong cat ngam
  log trong detail.

Phase 2 neu log nhieu:

```txt
GET /rental-orders/:id/logs?page=1&perPage=20
```

Khi co API phan trang rieng, `GET /rental-orders/:id` co the chi tra `logsPreview` hoac khong tra logs tuy UI.

## Response Detail Phase 1

`GET /rental-orders/:id` tra them:

```json
{
  "activityLogs": [
    {
      "id": "019fe-log-001",
      "actorId": "019fe-user-001",
      "actorSnapshot": {
        "name": "Nguyen Admin",
        "email": "admin@example.com"
      },
      "action": "UPDATE_ORDER",
      "entity": "RENTAL_ORDER",
      "changes": { "version": 1, "changedFields": ["customerSnapshot.phone"] },
      "note": "Gia han them 1 ngay",
      "createdAt": "2026-08-12T04:20:00.000Z"
    }
  ]
}
```

Mac dinh sort:

```txt
createdAt asc
```

## Frontend Plan

Trong tab `Lich su` cua detail/update dialog, chia thanh 3 card:

```txt
Lich su thanh toan
Lich su trang thai
    Nhat ky thao tac
```

`Nhat ky thay doi` render dang timeline:

```txt
12/08/2026 11:20 - Nguyen Admin cap nhat don thue
- So dien thoai: 0900000000 -> 0911111111
- Gio tra: 15/08 18:00 -> 16/08 18:00
- Tien coc ap dung: 800.000 -> 1.600.000
```

## Implementation Plan

### Phase 1 - Core Audit Log

- [x] Them Prisma model `RentalOrderLog`.
- [x] Them relation `RentalOrder.logs`.
- [x] Tao migration.
- [x] Generate Prisma client.
- [x] Tao DTO output cho log.
- [x] Include `logs` trong detail response va expose duoi ten `activityLogs`.
- [x] Viet mapper `toActivityLogOut`.

### Phase 2 - Service Helper

- [x] Tao helper transaction noi bo `createRentalOrderLog`.
- [x] Ham append log voi `{ orderId, actor, action, entity, changes, note }`.
- [x] Ham build `actorSnapshot`.
- [ ] Ham diff field don gian cho scalar/date/money/string.
- [ ] Bo qua create log neu `changes` rong va action khong bat buoc.

### Phase 3 - Wire Vao Cac API

- [x] `POST /rental-orders`: log `CREATE_ORDER`.
- [x] `PATCH /rental-orders/:id`: log `UPDATE_ORDER`.
- [x] Payment create/confirm/reject: log `RECORD_PAYMENT`, `CONFIRM_PAYMENT`, `REJECT_PAYMENT`.
- [x] Handover/return/inspection/settle: log thao tac tuong ung.
- [x] Refund create/confirm: log `CREATE_REFUND`, `CONFIRM_REFUND`.
- [x] `POST /rental-orders/:id/cancel`: log `CANCEL_ORDER`.
- [x] `POST /rental-orders/:id/close-cancellation`: log `CLOSE_CANCELLED_ORDER`.
- [x] `DELETE /rental-orders`: log `DELETE_ORDER` trong soft delete transaction.

### Phase 4 - Frontend

- [x] Them type `RentalOrderActivityLog`.
- [x] Detail response nhan `activityLogs`.
- [x] Tab `Lich su` them card `Nhat ky thao tac`.
- [ ] Render changes theo label, oldValue, newValue.
- [ ] Format tien/ngay gio theo field/value type.

### Phase 5 - Later Optimization

- [ ] Neu log nhieu, them `GET /rental-orders/:id/logs`.
- [ ] Them pagination/infinite scroll cho tab lich su.
- [ ] Queue notification/webhook neu co, khong queue audit log cot loi.
