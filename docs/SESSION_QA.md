# Tổng hợp Q&A phiên làm việc - Rental Admin Backend

Ngày tổng hợp: 2026-06-06

File này ghi lại các câu hỏi, quyết định và câu trả lời chính trong phiên làm việc về dự án `rental-admin-be`.
Nội dung được tổng hợp theo dòng thời gian/chủ đề, không phải transcript thô từng token.

---

## 1. Định hướng dự án CMS sang Admin-first Rental

### Q: Dự án trước là CMS khách tự đặt và thanh toán, bây giờ muốn xây hệ thống admin để admin quản lý và tạo đơn thuê cho khách được không?

A: Được. Hướng phù hợp là chuyển sang **admin-first rental management**:

- Admin/staff tạo khách hàng.
- Admin/staff tạo đơn thuê.
- Admin chọn sản phẩm hoặc thiết bị vật lý.
- Admin ghi nhận thanh toán thủ công.
- Admin bàn giao, nhận trả, kiểm tra, hoàn cọc.
- Không xây checkout/cart/payment gateway trong phase 1.

### Q: Phần checkout trước mắt admin quản lý thủ công thì DB cần thay đổi gì?

A: Bỏ các concept checkout-oriented như:

- Cart
- Guest session
- Online payment callback
- Auto hold payment theo khách tự checkout

Tập trung schema vào:

- `User`
- `Role`
- `Permission`
- `Customer`
- `Product`
- `AssetUnit`
- `RentalOrder`
- `RentalOrderItem`
- `PaymentRecord`
- `OrderStatusHistory`
- `OrderHandover`
- `ReturnInspection`
- `DamageReport`

### Q: RBAC nên xử lý flow như thế nào?

A: Không dùng một enum role trong `User`. Dùng mô hình:

- `User`
- `Role`
- `Permission`
- `UserRole`
- `RolePermission`

Flow:

1. User login.
2. JWT strategy load user + roles + permissions từ DB.
3. Guard đọc metadata `@RequirePermissions(...)`.
4. So permission của route với permission user có.

---

## 2. Prisma, DB, migration, generated client

### Q: Prisma generated client nên để đâu?

A: Không nên để trong `src/generated`. Để ngoài `src`, ví dụ:

```txt
generated/prisma
```

Tránh TypeScript/Nest compile nhầm generated files.

### Q: Lỗi TS2742 trong `generated/prisma/internal/prismaNamespaceBrowser.ts` và import `@generated/prisma/client` không thấy?

A: Nguyên nhân thường do generated client nằm sai chỗ hoặc path alias chưa khớp. Cách xử lý:

- Đưa Prisma generated ra ngoài `src`.
- Cấu hình `paths` alias đúng.
- Chạy lại:

```bash
pnpm prisma generate
pnpm typecheck
```

### Q: Chạy `pnpm start:dev` bị lâu?

A: `start:dev` chủ yếu watch app bằng Nest. Typecheck riêng có thể chạy `pnpm typecheck`. Nếu muốn nhanh hơn có thể dùng SWC/watch theo config hiện có. Không nên import seeder vào `AppModule` vì app startup sẽ nặng và side-effect.

### Q: Seeder có nên làm để migration lần đầu ổn không?

A: Có. Seeder nên chạy thủ công:

```bash
pnpm db:seed
```

Không import seeder vào `AppModule`.

Seeder hiện có:

- Permissions
- Roles
- Default admin
- RentalPolicy DEFAULT
- StoreBusinessHour 7 ngày

### Q: Drift detected khi tạo migrate init là gì?

A: DB hiện tại khác migration history. Nếu muốn khởi tạo lại từ đầu trong môi trường dev thì dùng:

```bash
pnpm prisma migrate reset --skip-seed
pnpm prisma migrate dev --name init --create-only
pnpm prisma migrate dev
pnpm prisma generate
pnpm db:seed
```

Lưu ý: reset sẽ mất dữ liệu.

---

## 3. AGENTS.md và quy ước code

### Q: Có cần viết file `.md` để sau này agent hiểu không?

A: Có. Nên viết `AGENTS.md`.

### Q: Nên viết tiếng Anh hay tiếng Việt?

A: Nên viết tiếng Anh cho phần coding convention, nhưng có thể mô tả nghiệp vụ tiếng Việt nếu team/owner dùng tiếng Việt. Trong phiên này đã có `AGENTS.md` mô tả:

- Admin-first rental direction
- Module naming
- DTO rules
- RBAC
- Auth status/errors
- Seeder
- Order flow
- Availability rule
- Phase 1 excluded features

---

## 4. Auth cookie, JWT, CSRF, RBAC

### Q: Auth nên dùng cookie không?

A: Có. Chốt dùng cookie-based admin auth:

- `admin_access_token`: HttpOnly
- `admin_refresh_token`: HttpOnly
- `admin_csrf_token`: không HttpOnly để frontend đọc và gửi header

### Q: `admin_csrf_token` dùng để làm gì?

A: Chống CSRF. Vì access/refresh token nằm trong cookie, browser tự gửi cookie. CSRF token buộc frontend hợp lệ phải đọc cookie `admin_csrf_token` rồi gửi:

```txt
x-csrf-token
```

### Q: Flow guard, strategy, API chạy theo thứ tự nào?

A:

1. Request vào route.
2. Guard chạy.
3. Guard gọi Passport strategy nếu cần validate JWT.
4. Strategy load user/session và attach `request.user`.
5. Permission guard check RBAC.
6. Controller gọi service.

### Q: Strategy có nên check status user không?

A: Có. JWT strategy và login flow nên reject user không active. Đã chốt dùng:

```ts
ACTIVE
BANNED
LOCKED
INACTIVE
```

Và map lỗi trong `error.constants.ts`, không hardcode trong service/guard.

### Q: ECONNREFUSED khi `this.prisma.user.findUnique()`?

A: DB/Postgres chưa chạy hoặc connection env sai. Cần kiểm tra:

- Docker/Postgres đang chạy chưa.
- `POSTGRES_HOST`, `POSTGRES_PORT`, user/password/db đúng chưa.
- Migration đã chạy chưa.

### Q: `AuthSession.sessionId` trong user có ý nghĩa gì?

A: Session ID nằm trong JWT refresh/access payload để biết token thuộc session nào. Dùng để:

- Rotate refresh token.
- Revoke session khi logout.
- Clear đúng session.
- Check CSRF hash theo session.

---

## 5. Response wrapper, validation pipe, error constants

### Q: Có nên viết response thống nhất kiểu `custom-response.type.ts` không?

A: Có. Dùng:

- `ApiRes<T>`
- `ApiNullableRes<T>`
- `ApiPaginatedResponseDto<T>`
- `ApiError<T>`

### Q: Response pagination nên truyền như thế nào?

A: Đã chốt constructor nhận object result:

```ts
new ApiPaginatedResponseDto(result, SUCCESS)
```

Trong đó:

```ts
{
  items,
  total,
  page,
  perPage
}
```

### Q: ValidatePipe quăng lỗi nhưng response bị UNKNOWN_ERROR?

A: Exception filter phải nhận đúng `ErrorResponse`. Validation pipe nên trả dạng:

```json
{
  "message": "Lỗi dữ liệu không hợp lệ",
  "code": "INCORRECT_INPUT",
  "error": [
    { "property": "password", "message": "..." }
  ]
}
```

### Q: Lỗi strict property initialization trong DTO/constant?

A: Dùng `!` hoặc `declare` cho Swagger DTO property:

```ts
id!: string;
declare data: UserOutDto;
```

---

## 6. Users module

### Q: User module nên có API nào?

A: Đã đề xuất:

```txt
GET    /api/admin/users
GET    /api/admin/users/:id
POST   /api/admin/users
PATCH  /api/admin/users/:id
PATCH  /api/admin/users/:id/activity-status
PATCH  /api/admin/users/:id/roles
DELETE /api/admin/users/:id
```

### Q: Thiếu API đổi mật khẩu và cập nhật tài khoản chính mình?

A: Đã bổ sung hướng:

```txt
PATCH /api/admin/auth/me
PATCH /api/admin/auth/me/password
```

### Q: `page` và `perPage` đã default nhưng TS báo possibly undefined?

A: Sửa `ApiPagReq` để property không optional:

```ts
page: number = DEFAULT_PAGE;
perPage: number = DEFAULT_PER_PAGE;
```

### Q: Permission enum nên viết thế nào?

A: Chốt `PermissionCode` dạng object:

```ts
OrdersRead: 'orders.read'
OrdersCreate: 'orders.create'
...
```

Sau đó dùng:

```ts
@RequirePermissions(PermissionCode.UsersCreate)
```

---

## 7. Customers module

### Q: Customer nên do admin tạo hay khách tự tạo?

A: Phase 1 admin-first: admin/staff tạo customer. Không có customer self-service.

### Q: `Customer.code` để làm gì?

A: Là mã khách hàng nội bộ để tra cứu dễ hơn, ví dụ:

```txt
CUS-000001
```

Không cho client nhập; service tự generate.

### Q: Customer output nên viết như thế nào?

A: Viết `CustomerOutDto`, không cần `GetAllCustomerOutDto` riêng nếu list/detail cùng shape.

### Q: `excludedCustomerId` nghĩa là gì?

A: Dùng khi update customer để check unique email/phone mà bỏ qua chính customer đang update.

### Q: Có nên dùng transaction khi tạo customer code?

A: Có. `generateCustomerCode(tx)` nên nhận transaction client để tránh đọc/ghi lệch trong transaction.

---

## 8. Search accent-insensitive, pg_trgm, searchText

### Q: Search không dấu nên dùng unaccent hay gì?

A: Chốt không dùng `unaccent` SQL per query. Dùng app-maintained `searchText`:

- Normalize tiếng Việt trong TypeScript.
- Lưu `searchText`.
- Query `contains`.
- Tối ưu PostgreSQL bằng `pg_trgm` + GIN index.

### Q: Có cần generated column không?

A: Không cần trong phase này. `searchText` cập nhật ở service create/update đủ rõ và dễ kiểm soát.

### Q: Index `@@index([email])`, `@@index([activityStatus])` để làm gì?

A: Tăng tốc query/filter/sort theo field thường dùng. GIN trigram index riêng dùng cho text search fuzzy/contains.

---

## 9. Products và AssetUnits

### Q: `Product` và `AssetUnit` khác nhau thế nào?

A:

- `Product`: loại/model sản phẩm cho thuê, ví dụ Sony A7 IV.
- `AssetUnit`: thiết bị vật lý/serial cụ thể, ví dụ Sony A7 IV SN001.

Nếu Sony A7 có 3 máy thì:

- 1 `Product`
- 3 `AssetUnit`

### Q: AssetUnit có cần `searchText` không?

A: Có nếu admin cần search serial/note/product. Đã thêm `searchText` và GIN trigram index.

### Q: Đã làm DTO/API AssetUnit gì?

A: Đã làm:

```txt
GET    /api/admin/asset-units
GET    /api/admin/asset-units/:id
POST   /api/admin/asset-units
PATCH  /api/admin/asset-units/:id
PATCH  /api/admin/asset-units/:id/status
DELETE /api/admin/asset-units/:id
```

### Q: Product DTO cần gì?

A: Product DTO gồm:

- Basic info
- Category/brand
- Prices
- Stock/isActive
- Rental price tiers

### Q: `hourlyOveragePrice` đã có chưa?

A: Có:

```prisma
hourlyOveragePrice Decimal? @db.Decimal(12, 2)
```

Dùng cho giờ dư sau ngày trọn vẹn nếu shop tính phụ thu giờ.

### Q: Nếu giá thuê theo combo ngày thì schema field thế nào?

A: Không thêm `price2Days`, `price3Days`. Thêm bảng:

```prisma
ProductRentalPriceTier
```

Ví dụ:

```txt
1-2 ngày: 200000/ngày
3-6 ngày: 180000/ngày
7+ ngày: 150000/ngày
```

### Q: API Product cần chỉnh gì khi thêm `ProductRentalPriceTier`?

A: Đã chỉnh:

- `CreateProductDto.rentalPriceTiers`
- `UpdateProductDto.rentalPriceTiers`
- `ProductOutDto.rentalPriceTiers`
- `ProductsService` create/update/include/map tiers

Update product nếu truyền `rentalPriceTiers` thì replace tiers hiện tại bằng cách soft delete tiers cũ rồi create tiers mới.

---

## 10. RentalPolicy, StoreBusinessHour, StoreClosure

### Q: `turnaroundMinutes` và phí đặt lịch mỗi máy có nên để trong order không?

A: Không nên chỉ để trong order. Nên có `RentalPolicy` làm cấu hình, còn order lưu snapshot.

### Q: `RentalPolicy` nên có field gì?

A: Chốt:

```prisma
code
name
bookingHoldAmountPerUnit
turnaroundMinutes
holdPaymentExpiresInMinutes
createdAt
updatedAt
```

Không cần:

- `isActive`
- `note`
- `allowPastStartDate`
- `requireFullPaymentBeforeHandover`
- `requireAssetAssignmentBeforeConfirm`

Rule thanh toán đủ trước khi giao máy là business rule cố định.

### Q: `RentalPolicy`, `StoreBusinessHour`, `StoreClosure` là bảng 1 row hay nhiều rows?

A:

- `RentalPolicy`: thường 1 row `DEFAULT`.
- `StoreBusinessHour`: 7 rows, mỗi thứ trong tuần một row.
- `StoreClosure`: nhiều rows, mỗi row là một khoảng nghỉ/off/bảo trì.

### Q: Có nên seed các bảng này không?

A: Có:

- Seed `RentalPolicy DEFAULT`.
- Seed 7 dòng `StoreBusinessHour`.
- Không seed `StoreClosure` vì là dữ liệu phát sinh.

### Q: API RentalPolicy và StoreBusinessHour đã làm gì?

A:

```txt
GET   /api/admin/rental-policy
PATCH /api/admin/rental-policy

GET /api/admin/store-business-hours
PUT /api/admin/store-business-hours
```

### Q: API StoreClosure cần gì?

A: Đã làm:

```txt
GET    /api/admin/store-closures
GET    /api/admin/store-closures/:id
POST   /api/admin/store-closures
PATCH  /api/admin/store-closures/:id
DELETE /api/admin/store-closures/:id
```

Delete là soft delete bằng `deletedAt`.

---

## 11. RentalOrder schema và nghiệp vụ cọc/giữ lịch

### Q: Nghiệp vụ cũ: khách đặt lịch 50.000/máy, sau đó thanh toán phần còn lại, hoàn cọc sau khi trả. RentalOrder nên sửa field gì?

A: Chốt các field chính:

```prisma
subtotal
depositTotal
upfrontTotal
bookingHoldTotal
handoverDueTotal
paidTotal
remainingTotal
refundTotal
turnaroundMinutes
blockedEndDate
holdExpiresAt
```

Ví dụ:

```txt
Giá thuê: 200.000
Tổng thu trước: 800.000
Đặt lịch: 50.000
Cần thu trước bàn giao: 750.000
Hoàn sau trả máy: 600.000
```

Mapping:

```txt
subtotal = 200000
upfrontTotal = 800000
bookingHoldTotal = 50000
handoverDueTotal = 750000
depositTotal/refundTotal = 600000
```

### Q: Khoảng cách 1 tiếng giữa các lượt thuê xử lý sao?

A:

```txt
blockedEndDate = endDate + turnaroundMinutes
```

Availability overlap:

```txt
existing.startDate < new.blockedEndDate
AND existing.blockedEndDate > new.startDate
```

### Q: Nếu tạo đơn mà 30 phút chưa thanh toán giữ lịch thì tự hủy?

A: Thêm:

```prisma
RentalPolicy.holdPaymentExpiresInMinutes Int @default(30)
RentalOrder.holdExpiresAt DateTime?
@@index([status, holdExpiresAt])
```

Cron/job phase sau sẽ query order quá hạn và cancel.

---

## 12. RentalOrders DTO và API plan

### Q: Viết DTO cho rental-orders?

A: Đã viết:

```txt
create-rental-order.dto.ts
update-rental-order.dto.ts
get-all-rental-orders.dto.ts
check-rental-order-availability.dto.ts
rental-order-actions.dto.ts
rental-order-out.dto.ts
rental-orders-response.dto.ts
```

### Q: API tiếp theo trong module rental-orders nên làm gì?

A: Plan core:

```txt
POST   /api/admin/rental-orders/check-availability
GET    /api/admin/rental-orders
GET    /api/admin/rental-orders/:id
POST   /api/admin/rental-orders
PATCH  /api/admin/rental-orders/:id
PATCH  /api/admin/rental-orders/:id/items/assign-assets
POST   /api/admin/rental-orders/:id/confirm
POST   /api/admin/rental-orders/:id/cancel
DELETE /api/admin/rental-orders/:id
```

Phase này chưa làm:

- Payment
- Handover
- Return
- Refund
- Complete

### Q: Order tạo ra status gì?

A: Chốt `DRAFT`.

`DRAFT` chưa block lịch.

### Q: Status nào block lịch?

A:

```txt
CONFIRMED
PREPARING
READY_FOR_PICKUP
DELIVERING
RENTING
OVERDUE
```

### Q: Rule tính giá thuê tự động thế nào?

A:

- `<= 6 giờ`: dùng `halfDayPrice`, fallback `dailyPrice`.
- `> 6 giờ` và `<= 24 giờ`: dùng `dailyPrice`.
- `> 24 giờ`: dùng daily tier theo số ngày + giờ dư theo `hourlyOveragePrice`.
- Nếu không có `hourlyOveragePrice`: làm tròn lên ngày.

---

## 13. Nest module import/export/providers

### Q: Module đang độc lập, có cần connect lại với nhau không?

A: Có nếu muốn dùng service module khác thay vì viết lại logic/query.

### Q: `imports`, `controllers`, `providers`, `exports` nghĩa là gì?

A:

```txt
providers = service/helper/repository thuộc module hiện tại
controllers = API controller thuộc module hiện tại
exports = service cho module khác inject
imports = module hiện tại muốn dùng service đã export từ module khác
```

### Q: Nên export/import các module nào?

A: Đã chỉnh export:

```txt
UsersModule -> UsersService
CustomersModule -> CustomersService
ProductsModule -> ProductsService
AssetUnitsModule -> AssetUnitsService
RentalPolicyModule -> RentalPolicyService
StoreBusinessHoursModule -> StoreBusinessHoursService
StoreClosureModule -> StoreClosureService
RentalOrdersModule -> RentalOrdersService
```

`RentalOrdersModule` import:

```txt
CustomersModule
ProductsModule
AssetUnitsModule
RentalPolicyModule
StoreBusinessHoursModule
StoreClosureModule
UsersModule
```

---

## 14. Commands đã chạy nhiều lần

Các lệnh kiểm tra/generate/build thường dùng trong phiên:

```bash
pnpm.cmd prisma format
pnpm.cmd prisma validate
pnpm.cmd prisma generate
pnpm.cmd typecheck
pnpm.cmd build
pnpm.cmd db:seed
```

Trên PowerShell nên dùng `pnpm.cmd` thay vì `pnpm` để tránh bị chặn `pnpm.ps1`.

---

## 15. Ghi chú triển khai tiếp theo

Các việc hợp lý tiếp theo:

1. Implement core `RentalOrdersService` theo plan đã chốt.
2. Thêm helper public cho các module đã export nếu muốn giảm query trùng:
   - `CustomersService.getCustomerForRental`
   - `ProductsService.getActiveProductsForRental`
   - `AssetUnitsService.getAssignableAssetUnits`
   - `RentalPolicyService.getDefaultPolicyForOrder`
   - `StoreBusinessHoursService.assertWithinBusinessHours`
   - `StoreClosureService.assertNoClosureOverlap`
3. Implement `check-availability`.
4. Implement create/list/detail/update rental order.
5. Implement confirm/cancel/assign-assets.
6. Phase sau mới làm payment/handover/return/refund/complete.

