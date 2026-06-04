# Agent Notes

## Project Direction

This backend is an admin-first rental management system for camera/video equipment.

Phase 1 focuses on internal admin operations. Admins and staff manually create rental orders, select customers, assign products or physical asset units, record payments, hand over equipment, receive returns, inspect returned items, and settle balances.

Do not build customer checkout flow unless explicitly requested.

## Tech Stack

- NestJS
- Prisma 7
- PostgreSQL
- RBAC with `User`, `Role`, `Permission`, `UserRole`, and `RolePermission`
- Prisma generated client is outside `src`: `generated/prisma`

## Current Architecture

Database-related providers live in:

```txt
src/modules/database/
  database.module.ts
  prisma.service.ts
```

Business modules should be organized under `src/modules/`, for example:

```txt
src/modules/auth
src/modules/users
src/modules/roles
src/modules/permissions
src/modules/customers
src/modules/products
src/modules/asset-units
src/modules/rental-orders
src/modules/payments
src/modules/returns
```

Seeder files live in:

```txt
src/migration/seeder/
```

The seeder must be run manually. Do not import the seeder into `AppModule`.

## Coding Conventions

### Module Naming

Use domain-based plural module names.

Recommended:

```txt
src/modules/users
src/modules/customers
src/modules/products
src/modules/asset-units
src/modules/rental-orders
```

Do not use vague module names such as `admin` for user management.

Meaning:

```txt
User      = internal admin/staff account
Customer  = rental customer
```

Use admin route prefixes in controllers, not in module names:

```ts
@Controller('admin/users')
export class UsersController {}

@Controller('admin/customers')
export class CustomersController {}
```

### Resource Structure

Each business module should follow this shape:

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

### Controller Responsibilities

Controllers should handle HTTP concerns only:

- route paths
- guards and permission decorators
- request DTOs
- response wrappers
- Swagger decorators
- cookies for auth endpoints
- status codes when needed

Controllers should return shared wrappers:

```ts
return new ApiRes(data, 'Message');
return new ApiNullableRes(dataOrNull, 'Message');
return new ApiPaginatedResponseDto(items, total, page, perPage, 'Message');
```

Controllers should use explicit Swagger response DTOs:

```ts
@ApiOkResponse({ type: UserResponseDto })
```

Avoid `@ApiOkResponse({ type: Object })` unless there is no better DTO yet.

### Service Responsibilities

Services should handle business logic only:

- validation that depends on database state
- Prisma queries and transactions
- status transitions
- permission-independent business rules
- formatting internal service results

Services should not:

- set cookies
- read/write `Response`
- wrap data with `ApiRes`
- hardcode user-facing error messages
- contain large multi-purpose methods when smaller private helpers are clearer

Prefer small private helper functions for reusable logic:

```ts
validateLoginCredentials();
validateAccessSession();
createAuthSession();
saveSessionTokens();
toAuthUser();
```

### DTO Rules

Input DTOs describe client input only. They should not include server-generated fields such as:

```txt
id
createdAt
updatedAt
deletedAt
passwordHash
refreshTokenHash
csrfTokenHash
```

Output DTOs should describe response shape for Swagger and should not expose sensitive fields.

Use `id`, not `_id`.

Use `!` or `declare` for Swagger DTO properties when strict property initialization complains:

```ts
id!: string;
declare data: UserOutDto;
```

### Permissions

Admin APIs should use permission decorators when access needs RBAC:

```ts
@RequirePermissions(PermissionCode.UsersCreate)
@Post()
create() {}
```

Public auth endpoints must be marked explicitly:

```ts
@Public()
@Post('login')
login() {}
```

### Accent-Insensitive Search

For admin list search, prefer an app-maintained normalized text column over calling SQL normalization functions inside every query.

Recommended pattern:

```txt
searchText = normalized email + fullName + phone
```

Normalize in TypeScript with `src/libs/utils/search-text.util.ts`, store the result on create/update, and query the `searchText` column.

For PostgreSQL performance, declare the `pg_trgm` extension and GIN trigram index in `schema.prisma` so Prisma migrations can generate them automatically:

```prisma
generator client {
  previewFeatures = ["postgresqlExtensions"]
}

datasource db {
  provider   = "postgresql"
  extensions = [pg_trgm]
}

model User {
  searchText String @default("")

  @@index([searchText(ops: raw("gin_trgm_ops"))], type: Gin, map: "User_searchText_trgm_idx")
}
```

Do not use Prisma `mode: 'insensitive'` as the main approach for Vietnamese accent-insensitive search, because it only handles case-insensitive matching and does not remove accents.

## Important Rules

- IDs are UUIDs, not Mongo ObjectIds.
- Do not add Mongoose or MongoDB patterns.
- Do not move Prisma generated files back into `src/generated`.
- Do not run seed logic automatically during normal app startup.
- Use `Product` for rentable product types/models.
- Use `AssetUnit` for physical devices or serial-number-managed inventory.
- `RentalOrderItem` must store price and product snapshots.
- Availability must be checked by rental time overlap, not only by asset status.
- Keep checkout/cart/payment-gateway logic out of phase 1 unless explicitly requested.
- Business/auth errors must be declared in `src/libs/constants/error.constants.ts`; do not hardcode error codes or user-facing messages inside services, guards, or strategies.

## Phase 1 Excluded

The following features are intentionally excluded for now:

- Cart
- Checkout endpoint
- Guest session
- Customer self-service ordering
- VNPay/MoMo callback
- Automatic online payment confirmation
- Auto-expiring hold-payment orders

## Core Database Concepts

### Product

A rentable product type or model.

Examples:

- Sony A7 IV
- Canon R5
- Lens 24-70

### AssetUnit

A physical rentable device under a product.

Examples:

- Sony A7 IV serial SN001
- Sony A7 IV serial SN002

If the shop does not manage serial numbers yet, use product-level quantity first, but keep the schema compatible with `AssetUnit`.

### RentalOrder

The main rental workflow entity.

It stores:

- customer snapshots
- rental start and end dates
- operational status
- payment status
- totals for rental, deposit, fees, paid amount, remaining amount, and refund amount
- assigned staff/admin

### RentalOrderItem

Line items in a rental order.

Each item must keep historical snapshots:

- product name
- SKU
- unit price
- deposit amount
- line total

Do not calculate old orders from the current product price.

### PaymentRecord

Manual record of collected or refunded money.

Common payment kinds:

- `HOLD_FEE`
- `DEPOSIT`
- `RENTAL_FEE`
- `LATE_FEE`
- `DAMAGE_FEE`
- `DELIVERY_FEE`
- `REFUND`
- `ADJUSTMENT`

### OrderStatusHistory

Audit log for every order status transition.

It should record:

- previous status
- next status
- user who changed the status
- note/reason
- timestamp

## Order Flow

Primary admin-first flow:

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

Checkout-oriented statuses such as `AWAITING_HOLD_PAYMENT`, `AWAITING_CONFIRMATION`, and `EXPIRED` should not be added back unless the customer checkout flow is introduced.

## Availability Rule

Availability is based on time overlap.

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
existing.startDate < new.endDate
AND existing.endDate > new.startDate
```

If an `assetUnitId` is assigned, prevent the same physical unit from being used in overlapping rental periods.

If only `productId` is used, sum overlapping quantities and compare against available product stock or active asset units.

## RBAC

Users should not store a single enum role for long-term authorization.

Use:

- `User`
- `Role`
- `Permission`
- `UserRole`
- `RolePermission`

Example permissions:

```txt
orders.read
orders.create
orders.update
orders.update_status
orders.cancel
orders.record_payment
orders.refund
customers.read
customers.create
customers.update
products.read
products.create
products.update
products.delete
assets.read
assets.create
assets.update
assets.delete
users.read
users.create
users.update
users.delete
roles.read
roles.create
roles.update
roles.delete
reports.read
```

## Auth Status And Errors

Prefer explicit user activity status over a plain boolean when the product needs distinct login failure reasons.

Recommended status values:

```txt
active
banned
locked
inactive
```

Map non-active statuses to reusable `ErrorResponse` constants in `src/libs/constants/error.constants.ts`, for example:

```ts
USER_BANNED;
USER_LOCKED;
USER_INACTIVE;
```

Auth services/strategies/guards should throw these shared constants instead of inline strings.

## Seeder

Run seed manually:

```bash
pnpm db:seed
```

Initial database setup can use:

```bash
pnpm db:setup
```

Default admin can be configured with:

```env
SEED_ADMIN_EMAIL=admin@rental.local
SEED_ADMIN_PASSWORD=Password123!
SEED_ADMIN_FULL_NAME=System Admin
```

## Useful Commands

```bash
pnpm prisma generate
pnpm prisma validate
pnpm prisma format
pnpm build
pnpm typecheck
pnpm start:dev
```

Development watch uses SWC for faster reload. Run `pnpm typecheck` separately when strict TypeScript checking is needed.
