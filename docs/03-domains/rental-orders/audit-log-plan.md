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

`changes` la JSON array, chi luu field that su thay doi. Khong luu full order snapshot neu khong can.

```json
[
  {
    "field": "customerSnapshot.phone",
    "label": "So dien thoai",
    "oldValue": "0900000000",
    "newValue": "0911111111"
  },
  {
    "field": "rentalPeriod.endDate",
    "label": "Gio tra",
    "oldValue": "2026-08-15T11:00:00.000Z",
    "newValue": "2026-08-16T11:00:00.000Z"
  },
  {
    "field": "financials.depositTotal",
    "label": "Tien coc ap dung",
    "oldValue": 800000,
    "newValue": 1600000
  }
]
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
POST   /rental-orders/:id/complete
POST   /rental-orders/:id/refunds
POST   /rental-orders/:id/cancel
DELETE /rental-orders
```

Action de xuat:

```txt
CREATE_ORDER
UPDATE_ORDER
RECORD_PAYMENT
HANDOVER_ORDER
COMPLETE_ORDER
REFUND_ORDER
CANCEL_ORDER
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
- Detail response chi include log moi nhat, vi du 30-50 records.

Phase 2 neu log nhieu:

```txt
GET /rental-orders/:id/logs?page=1&perPage=20
```

Khi co API phan trang rieng, `GET /rental-orders/:id` co the chi tra `logsPreview` hoac khong tra logs tuy UI.

## Response Detail Phase 1

`GET /rental-orders/:id` co the tra them:

```json
{
  "logs": [
    {
      "id": "019fe-log-001",
      "actorId": "019fe-user-001",
      "actorSnapshot": {
        "name": "Nguyen Admin",
        "email": "admin@example.com"
      },
      "action": "UPDATE_ORDER",
      "entity": "RENTAL_ORDER",
      "changes": [],
      "note": "Gia han them 1 ngay",
      "createdAt": "2026-08-12T04:20:00.000Z"
    }
  ]
}
```

Mac dinh sort:

```txt
createdAt desc
limit 50
```

## Frontend Plan

Trong tab `Lich su` cua detail/update dialog, chia thanh 3 card:

```txt
Lich su thanh toan
Lich su trang thai
Nhat ky thay doi
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
- [x] Include `logs` moi nhat trong detail response.
- [x] Viet mapper `toRentalOrderLogOut`.

### Phase 2 - Service Helper

- [x] Tao helper/service `RentalOrderLogsService`.
- [x] Ham `appendLog(tx, { orderId, actor, action, entity, changes, note })`.
- [x] Ham build `actorSnapshot`.
- [x] Ham diff field don gian cho scalar/date/money/string.
- [x] Bo qua create log neu `changes` rong va action khong bat buoc.

### Phase 3 - Wire Vao Cac API

- [x] `POST /rental-orders`: log `CREATE_ORDER`.
- [x] `PATCH /rental-orders/:id`: log `UPDATE_ORDER`, diff field customer/date/items/financials.
- [x] `POST /rental-orders/:id/payments`: log `RECORD_PAYMENT`.
- [x] `POST /rental-orders/:id/handover`: log `HANDOVER_ORDER`.
- [x] `POST /rental-orders/:id/complete`: log `COMPLETE_ORDER`.
- [x] `POST /rental-orders/:id/refunds`: log `REFUND_ORDER`.
- [x] `POST /rental-orders/:id/cancel`: log `CANCEL_ORDER`.
- [x] `DELETE /rental-orders`: log `DELETE_ORDER` truoc/hoac trong soft delete transaction.

### Phase 4 - Frontend

- [ ] Them type `RentalOrderLog`.
- [ ] Detail/update response nhan `logs`.
- [ ] Tab `Lich su` them card `Nhat ky thay doi`.
- [ ] Render changes theo label, oldValue, newValue.
- [ ] Format tien/ngay gio theo field/value type.

### Phase 5 - Later Optimization

- [ ] Neu log nhieu, them `GET /rental-orders/:id/logs`.
- [ ] Them pagination/infinite scroll cho tab lich su.
- [ ] Queue notification/webhook neu co, khong queue audit log cot loi.
