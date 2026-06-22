# Rental Admin Backend Modules And Endpoints

Tai lieu nay liet ke cac module backend, endpoint hien co, va cac endpoint nen bo sung theo thiet ke database trong `prisma/schema.prisma`.

## Route Convention

Global prefix hien tai trong `src/main.ts`:

```txt
/api
```

Vi du controller `@Controller('users')` se thanh:

```txt
/api/users
```

Huong khuyen nghi cho admin API ve sau:

```txt
/api/admin/<resource>
```

Neu doi theo convention trong AGENTS.md, nen update controller prefix dan dan:

```ts
@Controller('admin/users')
export class UsersController {}
```

## Module Structure

Moi business module nen theo cau truc:

```txt
src/modules/<resource>/
  dto/
    create-<resource>.dto.ts
    update-<resource>.dto.ts
    <resource>-out.dto.ts
    <resource>-response.dto.ts
  <resource>.controller.ts
  <resource>.service.ts
  <resource>.module.ts
```

Controller chi nen xu ly HTTP concerns:

```txt
- route path
- guard / permission decorator
- request DTO
- response wrapper
- Swagger decorators
- cookie only for auth endpoints
```

Service chi nen xu ly business logic:

```txt
- validate database state
- Prisma query / transaction
- status transition
- availability check
- manual payment settlement
- mapping entity to output DTO
```

## Existing Modules

| Module | DB models chinh | Current route prefix | Muc dich |
|---|---|---|---|
| `auth` | `User`, `Role`, `Permission`, `UserRole`, `RolePermission` | `/api/admin/auth` | Dang nhap, refresh, logout, profile, password |
| `users` | `User`, `UserRole` | `/api/users` | Quan ly tai khoan admin/staff |
| `roles` | `Role`, `RolePermission`, `UserRole` | `/api/roles` | Quan ly vai tro va gan role |
| `permissions` | `Permission` | `/api/permissions` | Xem permission catalog |
| `customers` | `Customer` | `/api/customers` | Quan ly khach thue |
| `products` | `Product`, `ProductRentalPriceTier`, `ProductCategory`, `Brand` | `/api/products` | Quan ly loai/model thiet bi cho thue |
| `asset-units` | `AssetUnit` | `/api/asset-units` | Quan ly thiet bi vat ly/serial |
| `rental-orders` | `RentalOrder`, `RentalOrderItem`, `OrderStatusHistory`, `OrderEvent` | `/api/rental-orders` | Tao va van hanh don thue |
| `rental-policy` | `RentalPolicy` | `/api/rental-policy` | Cau hinh chinh sach thue mac dinh |
| `store-business-hours` | `StoreBusinessHour` | `/api/store-business-hours` | Cau hinh gio mo cua |
| `store-closure` | `StoreClosure` | `/api/store-closures` | Cau hinh ngay nghi/lich chan |
| `database` | Prisma client | none | Database provider |
| `mail` | none | none | Gui email he thong |

## Existing Endpoints

### Auth

Base path:

```txt
/api/admin/auth
```

| Method | Path | Public | Muc dich |
|---|---|---:|---|
| `POST` | `/login` | yes | Dang nhap admin/staff, set auth cookies |
| `POST` | `/forgot-password` | yes | Gui email quen mat khau |
| `POST` | `/reset-password` | yes | Dat lai mat khau bang token |
| `GET` | `/reset-password/verify` | yes | Kiem tra reset token |
| `POST` | `/refresh` | yes | Refresh access/refresh token |
| `POST` | `/logout` | no | Clear auth cookies |
| `GET` | `/me` | no | Lay current user |
| `PATCH` | `/me` | no | Cap nhat profile current user |
| `PATCH` | `/me/password` | no | Doi mat khau current user |

### Users

Base path:

```txt
/api/users
```

| Method | Path | Permission | Muc dich |
|---|---|---|---|
| `GET` | `/` | `users.read` | Lay danh sach user |
| `GET` | `/:id` | `users.read` | Lay chi tiet user |
| `POST` | `/` | `users.create` | Tao user admin/staff |
| `PATCH` | `/:id` | `users.update` | Cap nhat user |
| `PATCH` | `/:id/activity-status` | `users.update` | Cap nhat trang thai user |
| `PATCH` | `/:id/roles` | `users.update` | Gan/thay role cua user |
| `PATCH` | `/:id/password` | `users.update` | Admin reset mat khau user |
| `DELETE` | `/:id` | `users.delete` | Xoa mem user |

### Roles

Base path:

```txt
/api/roles
```

| Method | Path | Permission | Muc dich |
|---|---|---|---|
| `GET` | `/` | `roles.read` | Lay danh sach role |
| `GET` | `/:id` | `roles.read` | Lay chi tiet role |
| `POST` | `/` | `roles.create` | Tao custom role |
| `PATCH` | `/:id` | `roles.update` | Cap nhat custom role |
| `PUT` | `/:id/permissions` | `roles.update` | Thay permission cua role |
| `PUT` | `/assign` | `users.update` | Gan role cho danh sach user |
| `DELETE` | `/` | `roles.delete` | Xoa nhieu custom role |

### Permissions

Base path:

```txt
/api/permissions
```

| Method | Path | Permission | Muc dich |
|---|---|---|---|
| `GET` | `/` | `roles.read` | Lay permission catalog |

### Customers

Base path:

```txt
/api/customers
```

| Method | Path | Permission | Muc dich |
|---|---|---|---|
| `GET` | `/` | `customers.read` | Lay danh sach khach hang |
| `GET` | `/:id` | `customers.read` | Lay chi tiet khach hang |
| `POST` | `/` | `customers.create` | Tao khach hang |
| `PATCH` | `/:id` | `customers.update` | Cap nhat khach hang |
| `PATCH` | `/:id/status` | `customers.update` | Cap nhat trang thai khach |
| `DELETE` | `/:id` | `customers.delete` | Xoa mem khach hang |

### Products

Base path:

```txt
/api/products
```

| Method | Path | Permission | Muc dich |
|---|---|---|---|
| `GET` | `/` | `products.read` | Lay danh sach product |
| `GET` | `/:id` | `products.read` | Lay chi tiet product |
| `POST` | `/` | `products.create` | Tao product |
| `PATCH` | `/:id` | `products.update` | Cap nhat product va price tiers |
| `PATCH` | `/:id/status` | `products.update` | Bat/tat product |
| `DELETE` | `/:id` | `products.delete` | Xoa mem product |

### Asset Units

Base path:

```txt
/api/asset-units
```

| Method | Path | Permission | Muc dich |
|---|---|---|---|
| `GET` | `/` | `assets.read` | Lay danh sach thiet bi vat ly |
| `GET` | `/:id` | `assets.read` | Lay chi tiet thiet bi vat ly |
| `POST` | `/` | `assets.create` | Tao thiet bi vat ly |
| `PATCH` | `/:id` | `assets.update` | Cap nhat thiet bi vat ly |
| `PATCH` | `/:id/status` | `assets.update` | Cap nhat status/condition |
| `DELETE` | `/:id` | `assets.delete` | Xoa mem/retire thiet bi |

### Rental Orders

Base path:

```txt
/api/rental-orders
```

| Method | Path | Permission | Muc dich |
|---|---|---|---|
| `POST` | `/check-availability` | `orders.read` | Kiem tra lich trong theo product/asset unit |
| `GET` | `/` | `orders.read` | Lay danh sach don thue |
| `GET` | `/:id` | `orders.read` | Lay chi tiet don thue |
| `POST` | `/` | `orders.create` | Tao don thue draft |
| `PATCH` | `/:id/items/assign-assets` | `orders.update` | Gan asset unit cho tung dong don |
| `POST` | `/:id/confirm` | `orders.update_status` | Chuyen `DRAFT -> CONFIRMED` |
| `POST` | `/:id/cancel` | `orders.cancel` | Huy don |
| `PATCH` | `/:id` | `orders.update` | Cap nhat don draft |
| `DELETE` | `/:id` | `orders.cancel` | Xoa mem don draft/cancelled |

### Rental Policy

Base path:

```txt
/api/rental-policy
```

| Method | Path | Permission | Muc dich |
|---|---|---|---|
| `GET` | `/` | `settings.read` | Lay policy mac dinh |
| `PATCH` | `/` | `settings.update` | Cap nhat policy mac dinh |

### Store Business Hours

Base path:

```txt
/api/store-business-hours
```

| Method | Path | Permission | Muc dich |
|---|---|---|---|
| `GET` | `/` | `settings.read` | Lay gio mo cua theo tuan |
| `PUT` | `/` | `settings.update` | Thay the gio mo cua theo tuan |

### Store Closures

Base path:

```txt
/api/store-closures
```

| Method | Path | Permission | Muc dich |
|---|---|---|---|
| `GET` | `/` | `settings.read` | Lay danh sach lich nghi/lich chan |
| `GET` | `/:id` | `settings.read` | Lay chi tiet lich nghi/lich chan |
| `POST` | `/` | `settings.update` | Tao lich nghi/lich chan |
| `PATCH` | `/:id` | `settings.update` | Cap nhat lich nghi/lich chan |
| `DELETE` | `/:id` | `settings.update` | Xoa mem lich nghi/lich chan |

## Modules Should Be Added From DB Design

Nhung model da co trong schema nhung chua co module endpoint rieng.

### Product Categories

Recommended module:

```txt
src/modules/product-categories/
```

Recommended base path:

```txt
/api/product-categories
```

| Method | Path | Permission | Muc dich |
|---|---|---|---|
| `GET` | `/` | `products.read` | Lay danh sach category |
| `GET` | `/:id` | `products.read` | Lay chi tiet category |
| `POST` | `/` | `products.create` | Tao category |
| `PATCH` | `/:id` | `products.update` | Cap nhat category |
| `PATCH` | `/:id/status` | `products.update` | Bat/tat category |
| `DELETE` | `/:id` | `products.delete` | Xoa mem category |

### Brands

Recommended module:

```txt
src/modules/brands/
```

Recommended base path:

```txt
/api/brands
```

| Method | Path | Permission | Muc dich |
|---|---|---|---|
| `GET` | `/` | `products.read` | Lay danh sach brand |
| `GET` | `/:id` | `products.read` | Lay chi tiet brand |
| `POST` | `/` | `products.create` | Tao brand |
| `PATCH` | `/:id` | `products.update` | Cap nhat brand |
| `PATCH` | `/:id/status` | `products.update` | Bat/tat brand |
| `DELETE` | `/:id` | `products.delete` | Xoa mem brand |

### Payments

Recommended module:

```txt
src/modules/payments/
```

Recommended base path:

```txt
/api/rental-orders/:orderId/payments
```

| Method | Path | Permission | Muc dich |
|---|---|---|---|
| `GET` | `/api/rental-orders/:orderId/payments` | `orders.read` | Lay lich su thanh toan cua don |
| `POST` | `/api/rental-orders/:orderId/payments` | `orders.record_payment` | Ghi nhan thu tien thu cong |
| `POST` | `/api/rental-orders/:orderId/refunds` | `orders.refund` | Ghi nhan hoan tien thu cong |
| `PATCH` | `/api/payments/:id` | `orders.record_payment` | Cap nhat ghi chu/reference/status neu can |
| `DELETE` | `/api/payments/:id` | `orders.record_payment` | Huy/xoa mem payment record neu chua settlement |

### Returns And Inspections

Recommended modules:

```txt
src/modules/returns/
src/modules/return-inspections/
```

Recommended base path:

```txt
/api/rental-orders/:orderId/returns
```

| Method | Path | Permission | Muc dich |
|---|---|---|---|
| `POST` | `/api/rental-orders/:id/start-renting` | `orders.update_status` | Chuyen sang `RENTING` khi ban giao |
| `POST` | `/api/rental-orders/:id/return` | `orders.update_status` | Ghi nhan khach tra may, set `actualReturnDate` |
| `POST` | `/api/rental-orders/:id/complete` | `orders.update_status` | Hoan tat don sau settlement |
| `GET` | `/api/rental-orders/:orderId/inspections` | `orders.read` | Lay bien ban kiem tra tra hang |
| `POST` | `/api/rental-orders/:orderId/inspections` | `orders.update` | Tao bien ban kiem tra tra hang |
| `PATCH` | `/api/return-inspections/:id` | `orders.update` | Cap nhat ket qua kiem tra |

### Damage Reports

Recommended module:

```txt
src/modules/damage-reports/
```

Recommended base path:

```txt
/api/return-inspections/:inspectionId/damage-reports
```

| Method | Path | Permission | Muc dich |
|---|---|---|---|
| `GET` | `/api/return-inspections/:inspectionId/damage-reports` | `orders.read` | Lay danh sach damage/missing report |
| `POST` | `/api/return-inspections/:inspectionId/damage-reports` | `orders.update` | Tao damage/missing report |
| `PATCH` | `/api/damage-reports/:id` | `orders.update` | Cap nhat phi/description/resolved |
| `DELETE` | `/api/damage-reports/:id` | `orders.update` | Xoa mem report |

### Order Handovers

Recommended module:

```txt
src/modules/order-handovers/
```

Recommended base path:

```txt
/api/rental-orders/:orderId/handovers
```

| Method | Path | Permission | Muc dich |
|---|---|---|---|
| `GET` | `/api/rental-orders/:orderId/handovers` | `orders.read` | Lay lich su ban giao/nhan tra |
| `POST` | `/api/rental-orders/:orderId/handovers` | `orders.update_status` | Tao bien ban ban giao/nhan tra |

### Order Events

Recommended module:

```txt
src/modules/order-events/
```

Recommended base path:

```txt
/api/rental-orders/:orderId/events
```

| Method | Path | Permission | Muc dich |
|---|---|---|---|
| `GET` | `/api/rental-orders/:orderId/events` | `orders.read` | Lay audit timeline cua don |
| `POST` | `/api/rental-orders/:orderId/events/note` | `orders.update` | Them note vao timeline |

Thong thuong `OrderEvent` nen duoc service tao tu dong khi status/payment/return thay doi; endpoint `POST note` chi dung khi admin them ghi chu thu cong.

## Suggested Development Order

1. Chuan hoa route prefix sang `admin/<resource>` neu muon follow AGENTS.md sat hon.
2. Hoan thien `rental-orders` status actions: prepare, ready, delivering, renting, returned, completed.
3. Them `payments` vi day la core flow thu tien thu cong.
4. Them `returns`, `return-inspections`, `damage-reports`.
5. Tach `product-categories` va `brands` neu UI can quan ly catalog rieng.
6. Them `order-events` read-only timeline cho man chi tiet don.

