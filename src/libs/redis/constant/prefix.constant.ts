/**
 * Redis prefixes and TTLs used by Rental Admin.
 *
 * Keep this file focused on namespaces that are actually planned for this
 * project. Avoid carrying over OTP/SMS/chat prefixes from other services.
 */
export const REDIS_PREFIX = {
  AUTH: 'auth',
  PASSWORD_RESET: 'auth:password-reset',
  LOGIN_ATTEMPT: 'auth:login-attempt',
  AUTH_LOCK: 'auth:lock',
  AUTH_RATE_LIMIT: 'auth:rate-limit',

  RENTAL_ORDER: 'rental:order',
  RENTAL_ASSET_UNIT: 'rental:asset-unit',
  RENTAL_AVAILABILITY: 'rental:availability',
  RENTAL_POLICY: 'rental:policy',
  STORE: 'rental:store',

  DASHBOARD_METRICS: 'dashboard:metrics',
  RBAC: 'rbac',
  EVENTS: 'events',
} as const;

export const REDIS_CHANNEL = {
  RENTAL_ORDER: `${REDIS_PREFIX.EVENTS}:rental-order`,
  ASSET_UNIT: `${REDIS_PREFIX.EVENTS}:asset-unit`,
  DASHBOARD: `${REDIS_PREFIX.EVENTS}:dashboard`,
  RBAC: `${REDIS_PREFIX.EVENTS}:rbac`,
} as const;

export const REDIS_EXPIRE = {
  PASSWORD_RESET_TOKEN: 30 * 60,
  LOGIN_ATTEMPT: 15 * 60,
  AUTH_LOCK: 15 * 60,
  RESET_PASSWORD_RATE_LIMIT: 60,

  IDEMPOTENCY: 2 * 60,
  DISTRIBUTED_LOCK: 30,
  AVAILABILITY_CACHE: 60,

  DASHBOARD_METRICS: 60,
  RENTAL_POLICY_CACHE: 10 * 60,
  STORE_BUSINESS_HOURS_CACHE: 10 * 60,
  RBAC_PERMISSION_CACHE: 10 * 60,
} as const;
