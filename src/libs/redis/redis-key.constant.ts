import { REDIS_PREFIX } from './constant/prefix.constant';

/**
 * Central Redis key builders.
 *
 * Naming rule: <domain>:<feature>:<identifier>[:<sub-identifier>]
 * Do not hard-code Redis keys in business services.
 */
export const REDIS_KEYS = {
  auth: {
    passwordResetToken: (tokenHash: string) => `${REDIS_PREFIX.PASSWORD_RESET}:token:${tokenHash}`,
    passwordResetUser: (userId: string) => `${REDIS_PREFIX.PASSWORD_RESET}:user:${userId}`,
    loginAttemptUser: (userId: string) => `${REDIS_PREFIX.LOGIN_ATTEMPT}:user:${userId}`,
    loginAttemptEmail: (normalizedEmail: string) => `${REDIS_PREFIX.LOGIN_ATTEMPT}:email:${normalizedEmail}`,
    loginAttemptIp: (ip: string) => `${REDIS_PREFIX.LOGIN_ATTEMPT}:ip:${ip}`,
    userLock: (userId: string) => `${REDIS_PREFIX.AUTH_LOCK}:user:${userId}`,
    resetPasswordRateLimit: (emailOrUserId: string) => `${REDIS_PREFIX.AUTH_RATE_LIMIT}:reset-password:${emailOrUserId}`,
    session: (sessionId: string) => `${REDIS_PREFIX.AUTH}:session:${sessionId}`,
    userSessions: (userId: string) => `${REDIS_PREFIX.AUTH}:user-sessions:${userId}`,
  },

  rentalOrder: {
    lock: (orderId: string) => `${REDIS_PREFIX.RENTAL_ORDER}:lock:${orderId}`,
    transition: (orderId: string) => `${REDIS_PREFIX.RENTAL_ORDER}:transition:${orderId}`,
    idempotency: (userId: string, requestHash: string) => `${REDIS_PREFIX.RENTAL_ORDER}:idempotency:${userId}:${requestHash}`,
  },

  rentalAvailability: {
    // Do not use this cache for inventory decisions. Availability is dynamic
    // and must be read from PostgreSQL when an order is confirmed or assigned.
    cache: (hash: string) => `${REDIS_PREFIX.RENTAL_AVAILABILITY}:cache:${hash}`,
  },

  rentalPolicy: {
    default: () => `${REDIS_PREFIX.RENTAL_POLICY}:default`,
  },

  store: {
    businessHours: () => `${REDIS_PREFIX.STORE}:business-hours`,
  },

  assetUnit: {
    lock: (assetUnitId: string) => `${REDIS_PREFIX.RENTAL_ASSET_UNIT}:lock:${assetUnitId}`,
    statusCache: (assetUnitId: string) => `${REDIS_PREFIX.RENTAL_ASSET_UNIT}:status-cache:${assetUnitId}`,
    productSummary: (productId: string) => `${REDIS_PREFIX.RENTAL_ASSET_UNIT}:product-summary:${productId}`,
  },

  dashboard: {
    overview: () => `${REDIS_PREFIX.DASHBOARD_METRICS}:overview`,
    orders: (dateRangeHash: string) => `${REDIS_PREFIX.DASHBOARD_METRICS}:orders:${dateRangeHash}`,
    assets: () => `${REDIS_PREFIX.DASHBOARD_METRICS}:assets`,
    revenue: (dateRangeHash: string) => `${REDIS_PREFIX.DASHBOARD_METRICS}:revenue:${dateRangeHash}`,
  },

  rbac: {
    userPermissions: (userId: string) => `${REDIS_PREFIX.RBAC}:user-permissions:${userId}`,
    rolePermissions: (roleId: string) => `${REDIS_PREFIX.RBAC}:role-permissions:${roleId}`,
  },
} as const;
