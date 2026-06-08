# Rental Admin Backend

Backend NestJS cho hệ thống quản lý cho thuê thiết bị camera/video theo hướng **admin-first**.

Phase hiện tại tập trung vào nghiệp vụ nội bộ: admin/staff tạo khách hàng, tạo đơn thuê, kiểm tra lịch trống, gán thiết bị vật lý, xác nhận/hủy đơn và chuẩn bị các bước thanh toán/bàn giao/trả máy cho phase sau.

## Tech Stack

- NestJS
- Prisma 7
- PostgreSQL
- RBAC bằng `User`, `Role`, `Permission`, `UserRole`, `RolePermission`
- Cookie-based admin auth với JWT + server-side `AuthSession`
- Prisma generated client nằm ngoài `src`: `generated/prisma`

Redis đã có service trong `docker-compose.yml`, nhưng hiện chưa được dùng trong code. Có thể dùng sau cho cache session/permission, rate limit, queue/job hoặc locking.

## Project Structure

```txt
src/modules/
  auth
  users
  customers
  products
  asset-units
  rental-policy
  store-business-hours
  store-closure
  rental-orders
  database

src/migration/seeder/
  seed.ts
  seeder.service.ts

postman/
  rental-admin-be.postman_collection.json

prisma/
  schema.prisma
  migrations/
```

## Requirements

- Node.js
- pnpm
- Docker / Docker Compose
- PostgreSQL 15 if not using Docker

## Environment

Create or update `.env`:

```env
PORT=4002

POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=postgres
POSTGRES_PASSWORD=12032001
POSTGRES_DB=rental_admin_db

JWT_ACCESS_SECRET=change-me-access-secret
JWT_REFRESH_SECRET=change-me-refresh-secret
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

AUTH_COOKIE_SECURE=false
AUTH_COOKIE_SAME_SITE=lax
ADMIN_WEB_ORIGIN=http://localhost:3001

SEED_ADMIN_EMAIL=admin@rental.local
SEED_ADMIN_PASSWORD=Password123!
SEED_ADMIN_FULL_NAME=System Admin
```

Create or update `docker.env` for Docker services:

```env
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=postgres
POSTGRES_PASSWORD=12032001
POSTGRES_DB=rental_admin_db
REDIS_PORT=6379
```

## Setup

Install dependencies:

```bash
pnpm install
```

Start local services:

```bash
docker compose up -d
```

Run migrations and seed data:

```bash
pnpm db:setup
```

Or run step by step:

```bash
pnpm prisma migrate dev
pnpm prisma generate
pnpm db:seed
```

The seeder is manual by design. Do not import seed logic into `AppModule`.

Seeder creates:

- permissions
- roles
- default admin
- default rental policy
- store business hours

Default login:

```txt
Email: admin@rental.local
Password: Password123!
```

## Running

Development:

```bash
pnpm start:dev
```

Production build:

```bash
pnpm build
pnpm start:prod
```

API base URL:

```txt
http://localhost:<PORT>/api
```

Swagger:

```txt
http://localhost:<PORT>/api/docs
```

With the sample `.env`, use:

```txt
http://localhost:4002/api/docs
```

## Useful Commands

```bash
pnpm prisma validate
pnpm prisma format
pnpm prisma generate
pnpm typecheck
pnpm build
pnpm test
pnpm test:e2e
```

On Windows PowerShell, use `pnpm.cmd` if `pnpm` is blocked:

```bash
pnpm.cmd typecheck
pnpm.cmd build
```

## Auth Flow

Admin auth uses HttpOnly cookies:

```txt
admin_access_token
admin_refresh_token
admin_csrf_token
```

Access token is JWT, but the app still checks `AuthSession` in PostgreSQL on authenticated requests. So auth is not stateless JWT-only; it is:

```txt
JWT cookie-based auth + server-side session validation
```

Unsafe requests (`POST`, `PATCH`, `PUT`, `DELETE`) must send:

```txt
x-csrf-token: <value from admin_csrf_token cookie>
```

## Postman

Import:

```txt
postman/rental-admin-be.postman_collection.json
```

If your app runs on port `4002`, update collection variable:

```txt
baseUrl = http://localhost:4002/api
```

Recommended test order:

```txt
Auth / Login
Setup Data / Create Customer
Setup Data / Create Product
Setup Data / Create Asset Unit
Rental Orders / Check Availability
Rental Orders / Create Rental Order
Rental Orders / Assign Asset To Order Item
Rental Orders / Confirm Rental Order
Rental Orders / Get Rental Order Detail
```

The collection automatically reads `admin_csrf_token` after login and sends `x-csrf-token` for unsafe requests.

## Rental Order Flow

Current core flow:

```txt
DRAFT
-> CONFIRMED
-> PREPARING
-> READY_FOR_PICKUP / DELIVERING
-> RENTING
-> RETURNED
-> COMPLETED
```

Additional statuses:

```txt
OVERDUE
CANCELLED
REFUNDING
REFUNDED
DISPUTED
```

Current `rental-orders` APIs:

```txt
POST   /api/rental-orders/check-availability
GET    /api/rental-orders
GET    /api/rental-orders/:id
POST   /api/rental-orders
PATCH  /api/rental-orders/:id
PATCH  /api/rental-orders/:id/items/assign-assets
POST   /api/rental-orders/:id/confirm
POST   /api/rental-orders/:id/cancel
DELETE /api/rental-orders/:id
```

Phase 1 excluded for now:

- cart
- checkout
- customer self-service ordering
- payment gateway callbacks
- automatic online payment confirmation

## Availability Rule

Availability is based on time overlap, not only asset status.

Blocking statuses:

```txt
CONFIRMED
PREPARING
READY_FOR_PICKUP
DELIVERING
RENTING
OVERDUE
```

Overlap condition:

```txt
existing.startDate < new.blockedEndDate
AND existing.blockedEndDate > new.startDate
```

`blockedEndDate` is:

```txt
endDate + turnaroundMinutes
```

If `assetUnitId` is assigned, the same physical unit cannot be used in overlapping rental periods.

If only `productId` is used, the service sums overlapping quantities and compares against active usable `AssetUnit` records. A product without usable asset units cannot be rented.

## Search

Admin search uses normalized `searchText` fields for accent-insensitive search.

Examples:

```txt
Customer.searchText
Product.searchText
AssetUnit.searchText
RentalOrder.searchText
```

The project uses `pg_trgm` + GIN indexes in `schema.prisma` for better PostgreSQL search performance.

## Notes

- `User` means internal admin/staff account.
- `Customer` means rental customer.
- `Product` means rentable model/type, for example Sony A7 IV.
- `AssetUnit` means physical device/serial, for example Sony A7 IV SN001.
- Product inventory is derived from `AssetUnit`; `Product` does not store fallback stock quantity.
- Business/auth errors should be declared in `src/libs/constants/error.constants.ts`.
- Controllers should return shared wrappers such as `ApiRes` and `ApiPaginatedResponseDto`.
