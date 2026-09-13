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
  AUTH_RATE_LIMIT: 'auth:rate-limit',

  RENTAL_ORDER: 'rental:order',
  RENTAL_ASSET_UNIT: 'rental:asset-unit',
  SYSTEM_SETTINGS: 'system:settings',
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
  RESET_PASSWORD_RATE_LIMIT: 60,

  IDEMPOTENCY: 2 * 60,
  DISTRIBUTED_LOCK: 30,

  SYSTEM_SETTINGS_CACHE: 60 * 60 * 24, // 1 day
  STORE_BUSINESS_HOURS_CACHE: 60 * 60 * 24,
  RBAC_PERMISSION_CACHE: 10 * 60,
} as const;
