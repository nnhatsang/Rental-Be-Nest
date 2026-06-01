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
users.manage
roles.manage
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
USER_BANNED
USER_LOCKED
USER_INACTIVE
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
