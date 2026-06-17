# Full Backend Test Flow

Use this with `postman/rental-admin-be.postman_collection.json`.

## Before Testing

1. Start PostgreSQL and Redis from Docker.
2. Run migrations and seed data.
3. Start backend with `pnpm start:dev`.
4. In Postman, set `baseUrl` to your backend, default: `http://localhost:4002/api`.
5. Run `01 Auth / Login Admin` first, or run the whole `08 Full Flow Runner` folder.

## Smoke Flow

| Step | Request | Expected |
| --- | --- | --- |
| 1 | Login Admin | 2xx, access/refresh auth cookies set |
| 2 | Update Store Business Hours | 7 business-hour rows returned |
| 3 | Create Customer | `customerId` saved |
| 4 | Create Product | `productId` saved. Product has no `stockQuantity` |
| 5 | Create Asset Unit | `assetUnitId` saved. Product now has rentable inventory |
| 6 | Check Availability | `data.isAvailable=true` |
| 7 | Create Rental Order | status `DRAFT`, order/item ids saved |
| 8 | Assign Asset | order item has selected asset unit |
| 9 | Confirm Order | status becomes `CONFIRMED` |
| 10 | Check Overlap Availability | unavailable if only one usable asset exists for that product/time |
| 11 | Cancel Order | status becomes `CANCELLED` |
| 12 | Delete Cancelled Order | success true |
| 13 | Create Staff User | `staffUserId` saved |
| 14 | Reset Staff Password | success true |
| 15 | Delete Staff User | success true |

## Auth Flow

- Login stores HttpOnly access/refresh cookies.
- Protected requests do not require a CSRF header.
- Refresh validates the refresh JWT and issues a new token pair.
- Logout clears auth cookies on the client.

## Forgot Password Flow

1. Run `01 Auth / Forgot Password` with an existing email.
2. Copy token from email link into `resetPasswordToken`.
3. Run `01 Auth / Reset Password - Requires Email Token`.
4. Login with the new password.

If SMTP is empty in local dev, email is skipped by `MailService`, so this flow needs SMTP config or a future test-only mail capture hook.

## Negative Cases To Check

- Login wrong password returns error.
- Forgot password with unknown email still returns generic success.
- Reset password with invalid token returns error.
- Admin reset own password via `/users/:id/password` is rejected.
- Create rental order before creating an asset unit should be unavailable.
- Confirm overlapping order should be rejected/unavailable.
- Delete non-DRAFT/non-CANCELLED order should be rejected.
