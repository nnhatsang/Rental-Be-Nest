# Redis Usage Plan

> Tai lieu mo ta vai tro Redis trong backend Rental Admin, cac nhom chuc nang can build, key pattern de thong nhat, va ke hoach trien khai theo giai doan.

---

## 1. Muc tieu

Redis trong Rental Admin khong phai la database nghiep vu chinh. PostgreSQL/Prisma van la source of truth cho user, product, asset unit, rental order, payment, status history va audit log.

Redis duoc dung cho cac nhu cau co tinh tam thoi, can toc do cao, TTL, counter, lock ngan han, cache ngan han, va realtime event fan-out.

Muc tieu chinh:

1. Tang toc cac du lieu doc nhieu, chap nhan cache ngan han.
2. Ho tro bao mat va chong spam nhu password reset, login attempt, rate limit.
3. Ho tro distributed lock de giam rui ro thao tac trung khi nhieu nhan vien cung xu ly mot don/thiet bi.
4. Ho tro realtime dashboard/socket bang pub/sub khi can scale nhieu instance backend.
5. Gom tat ca key Redis vao mot noi de tranh trung key va de de invalidate cache.

---

## 2. Nguyen tac su dung

### 2.1 Redis duoc dung cho

- Token tam thoi: password reset.
- Counter co TTL: login failed attempts, API rate limit, resend email limit.
- Cache ngan han: dashboard metrics, rental policy, permission snapshot, danh sach lookup nho.
- Distributed lock ngan han: confirm order, assign asset unit, transition order status.
- Realtime event: publish order/asset/dashboard update cho socket gateway.
- Idempotency key: chan double submit trong cac hanh dong nhay cam.

### 2.2 Redis khong duoc dung cho

- Luu trang thai don thue vinh vien.
- Luu lich su trang thai don hang.
- Quyet dinh overlap booking nhu source of truth duy nhat.
- Thay the transaction/constraint cua PostgreSQL.
- Luu audit log bat buoc.

Redis co the cache ket qua availability, nhung khi confirm/giao may/cap nhat don van phai check lai bang database.

---

## 3. Hien trang code

Backend hien co wrapper tai:

- `src/libs/redis/redis.module.ts`
- `src/libs/redis/redis.service.ts`
- `src/libs/redis/constant/prefix.constant.ts`
- `src/libs/redis/redis-key.constant.ts`

Wrapper hien dang dung `@liaoliaots/nestjs-redis` de lay raw `ioredis` client bang `getOrThrow()`.

Function hien co:

- `get(key)`
- `set(key, value, ttlSeconds?)`
- `del(...keys)`
- `exists(key)`
- `ttl(key)`
- `pipeline()`
- `getClient()`

Module dang dung Redis ro nhat:

- `PasswordResetTokenService`: tao, verify, consume password reset token.

---

## 4. Khac biet voi RedisService cua chat/socket project

RedisService o chat project gom 2 lop chuc nang:

1. Wrapper generic: get/set/json/set/list/pipeline/ttl/delete.
2. Chat-specific: channel members, channel messages, get channels, delete channel messages.

Rental Admin khong nen copy nguyen phan chat-specific vi business khac nhau.

Rental Admin nen giu wrapper hien tai va mo rong theo huong:

- Generic Redis primitives.
- Business helper cho auth/rate-limit/cache/lock/pub-sub.
- Key pattern theo domain rental.

---

## 5. De xuat function can build

### 5.1 Generic wrapper

```ts
get(key: string): Promise<string | null>
set(key: string, value: string, ttlSeconds?: number): Promise<void>
del(...keys: string[]): Promise<void>
exists(key: string): Promise<boolean>
ttl(key: string): Promise<number>
expire(key: string, ttlSeconds: number): Promise<void>
pipeline(): ChainableCommander
getClient(): Redis
```

Dang co gan du, chi can bo sung `expire`.

### 5.2 JSON helper

```ts
getJson<T>(key: string): Promise<T | null>
setJson(key: string, value: unknown, ttlSeconds?: number): Promise<void>
mgetJson<T>(keys: string[]): Promise<Array<T | null>>
msetJson(items: Array<{ key: string; value: unknown; ttlSeconds?: number }>): Promise<void>
setJsonKeepTTL(key: string, value: unknown): Promise<void>
```

Dung cho:

- Dashboard metrics.
- Rental policy cache.
- Permission snapshot.
- Payload token tam thoi neu muon tranh parse lap lai o service nghiep vu.

### 5.3 Counter/rate-limit helper

```ts
incrWithTTL(key: string, ttlSeconds: number): Promise<number>
resetCounter(key: string): Promise<void>
```

Dung cho:

- Dem sai mat khau theo user/email/IP.
- Gioi han gui lai email reset password.
- Gioi han API nhay cam neu can.

### 5.4 Lock/idempotency helper

```ts
acquireLock(key: string, ttlSeconds: number): Promise<string | null>
releaseLock(key: string, token: string): Promise<boolean>
withLock<T>(key: string, ttlSeconds: number, fn: () => Promise<T>): Promise<T>
setNx(key: string, value: string, ttlSeconds: number): Promise<boolean>
```

Yeu cau:

- Lock phai co token rieng de tranh request A xoa lock cua request B.
- Release lock nen dung Lua script hoac logic atomic tuong duong.
- TTL ngan, thuong 5-30 giay tuy thao tac.
- Khi khong lay duoc lock, tra loi loi nghiep vu dang co thao tac dang xu ly.

Dung cho:

- `rental-orders.confirm`
- `rental-orders.assign-assets`
- `rental-orders.transition-status`
- `asset-units.update-status`

### 5.5 Cache helper

```ts
rememberJson<T>(key: string, ttlSeconds: number, loader: () => Promise<T>): Promise<T>
deleteByPattern(pattern: string): Promise<void>
scanKeys(pattern: string, count?: number): Promise<string[]>
```

Yeu cau:

- Dung `SCAN`, khong dung `KEYS` trong production.
- Cache data phai co TTL.
- Cac service thay doi du lieu phai invalidate key lien quan.

Dung cho:

- Dashboard count by order status.
- Dashboard asset availability summary.
- Rental policy default.
- RBAC permission snapshot neu can.

### 5.6 Pub/Sub helper

```ts
publish(channel: string, payload: unknown): Promise<void>
subscribe(channel: string, handler: (payload: unknown) => Promise<void> | void): Promise<void>
unsubscribe(channel: string): Promise<void>
```

Dung khi co socket/realtime dashboard:

- Don hang thay doi trang thai.
- Thiet bi thay doi trang thai.
- Dashboard can refresh metrics.
- Permission/RBAC thay doi va can sync realtime.

Neu chi co mot backend instance va chua co socket, co the de phase sau.

---

## 6. Key naming convention

Quy tac:

```text
<domain>:<feature>:<identifier>[:<sub-identifier>]
```

Tat ca prefix/TTL/channel nen dat trong `src/libs/redis/constant/prefix.constant.ts`.
Tat ca key builder nen dat trong `src/libs/redis/redis-key.constant.ts` va phai dung `REDIS_PREFIX`, khong hard-code namespace.

### 6.1 Auth

```ts
REDIS_KEYS.auth.passwordResetToken(tokenHash)
REDIS_KEYS.auth.passwordResetUser(userId)
REDIS_KEYS.auth.loginAttemptUser(userId)
REDIS_KEYS.auth.loginAttemptEmail(normalizedEmail)
REDIS_KEYS.auth.loginAttemptIp(ip)
REDIS_KEYS.auth.userLock(userId)
REDIS_KEYS.auth.resetPasswordRateLimit(emailOrUserId)
REDIS_KEYS.auth.session(sessionId)
REDIS_KEYS.auth.userSessions(userId)
```

### 6.2 Rental order

```ts
REDIS_KEYS.rentalOrder.lock(orderId)
REDIS_KEYS.rentalOrder.transition(orderId)
REDIS_KEYS.rentalOrder.idempotency(userId, requestHash)
REDIS_KEYS.rentalAvailability.cache(hash)
```

### 6.3 Asset unit

```ts
REDIS_KEYS.assetUnit.lock(assetUnitId)
REDIS_KEYS.assetUnit.statusCache(assetUnitId)
REDIS_KEYS.assetUnit.productSummary(productId)
```

### 6.4 Dashboard

```ts
REDIS_KEYS.dashboard.overview()
REDIS_KEYS.dashboard.orders(dateRangeHash)
REDIS_KEYS.dashboard.assets()
REDIS_KEYS.dashboard.revenue(dateRangeHash)
```

### 6.5 RBAC

```ts
REDIS_KEYS.rbac.userPermissions(userId)
REDIS_KEYS.rbac.rolePermissions(roleId)
```

### 6.6 Pub/Sub channels

```ts
REDIS_CHANNEL.RENTAL_ORDER
REDIS_CHANNEL.ASSET_UNIT
REDIS_CHANNEL.DASHBOARD
REDIS_CHANNEL.RBAC
```

---

## 7. TTL de xuat

| Nhom | TTL de xuat | Ghi chu |
|---|---:|---|
| Password reset token | 15-30 phut | Theo config hien co |
| Auth session | Bang `JWT_REFRESH_EXPIRES_IN` | Luu refresh token hash va metadata thiet bi |
| Login attempt counter | 15 phut | Reset khi login thanh cong |
| Account temporary lock | 15-30 phut | Tuy policy bao mat |
| Idempotency key | 30-120 giay | Chon theo UX double submit |
| Distributed lock | 5-30 giay | Ngan, phu hop thao tac DB |
| Dashboard metrics | 30-120 giay | Invalidate khi co event quan trong |
| Rental policy cache | 5-15 phut | Invalidate khi update policy |
| RBAC permission cache | 5-15 phut | Invalidate khi gan role/permission |
| Availability cache | 15-60 giay | Chi dung cho quick check, confirm phai check DB lai |

---

## 8. Luong nghiep vu nen ap dung Redis

### 8.1 Password reset

Trang thai: da co.

Can giu:

- Token raw chi gui qua email.
- Redis chi luu token hash.
- Moi user chi co mot token active.
- Consume xong phai xoa ca token key va user key.

Co the bo sung:

- Rate limit gui email reset password.
- Counter theo email/IP.

### 8.2 Login failed attempts

Flow de xuat:

1. Khi login sai, `incrWithTTL(auth:login-attempt:user:<userId>, 900)`.
2. Neu vuot nguong, set `auth:lock:user:<userId>` TTL 15-30 phut hoac cap nhat DB status `LOCKED` tuy policy.
3. Khi login thanh cong, xoa counter.
4. Neu dung DB status `LOCKED`, Redis chi nen lam bo dem/lock tam thoi; DB van ghi trang thai neu can hien thi/admin audit.

### 8.3 Auth session & refresh token store

Trang thai: dung cho login/refresh/logout hien tai.

Key:

- `auth:session:<sessionId>`: JSON session co TTL bang refresh token.
- `auth:user-sessions:<userId>`: set cac `sessionId` dang active cua user.

Session JSON:

```json
{
  "sessionId": "uuid",
  "userId": "uuid",
  "refreshTokenHash": "sha256-hmac-hex",
  "createdAt": "2026-07-01T00:00:00.000Z",
  "lastUsedAt": "2026-07-01T00:00:00.000Z",
  "expiresAt": "2026-07-08T00:00:00.000Z",
  "ipAddress": "192.168.0.1",
  "userAgent": "Iphone 15",
  "deviceId": "device-id",
  "fcmToken": "push-token"
}
```

Flow:

1. Login tao `sessionId`, issue access/refresh JWT co `sid`, hash refresh token roi luu session vao Redis.
2. Access strategy bat buoc JWT co `sid`; backend check `auth:session:<sid>` con ton tai va thuoc dung user.
3. Refresh strategy doc raw refresh token tu HttpOnly cookie, compare hash voi Redis session.
4. Refresh thanh cong se rotate refresh token va update `refreshTokenHash`, `lastUsedAt`, TTL.
5. Logout xoa `auth:session:<sid>` va remove `sid` khoi `auth:user-sessions:<userId>`.
6. Change/reset password xoa toan bo sessions trong `auth:user-sessions:<userId>`.

Ghi chu:

- Access/refresh token van nam trong HttpOnly cookies `admin_access_token` va `admin_refresh_token`.
- Redis chi luu hash refresh token, khong luu raw token.
- Nhieu thiet bi duoc dang nhap cung luc; moi thiet bi co session rieng.

### 8.4 RBAC permission cache

Trang thai: de phase sau, chua nen bat ngay neu chua co invalidate day du.

Hien tai `validateAccessUser` nen tiep tuc doc roles/permissions tu DB de dam bao quyen la source of truth moi nhat. Redis chi dang dung cho auth session, refresh token hash, login counter va rate limit.

Khi can toi uu RBAC, co the cache:

```ts
REDIS_KEYS.rbac.userPermissions(userId)
REDIS_KEYS.rbac.rolePermissions(roleId)
```

Payload de xuat:

```json
{
  "userId": "uuid",
  "roles": ["ADMIN"],
  "permissions": ["orders.read", "orders.create"],
  "cachedAt": "2026-07-02T00:00:00.000Z"
}
```

Yeu cau truoc khi bat cache:

1. Invalidate `rbac:user-permissions:<userId>` khi gan/xoa role cua user.
2. Invalidate user permission cache cua tat ca user thuoc role khi role permission thay doi.
3. Invalidate khi user bi `BANNED`, `LOCKED`, `INACTIVE` hoac bi xoa.
4. TTL ngan, de xuat 5-15 phut.
5. DB van la source of truth khi cache miss.

Rui ro can tranh: permission cache stale lam user tiep tuc dung quyen cu sau khi admin da thu hoi quyen.

### 8.5 Confirm rental order

Flow de xuat:

1. Lay lock `rental:order:lock:<orderId>`.
2. Lay them lock tung `rental:asset-unit:lock:<assetUnitId>` neu order da gan serial.
3. Query DB va check lai availability overlap.
4. Trong transaction: cap nhat status, ghi status history, ghi order event.
5. Sau transaction: invalidate dashboard cache va publish event.
6. Release lock.

Redis lock khong thay the DB transaction. No chi giam rui ro 2 request cung chay qua check cung luc.

### 8.6 Assign asset unit

Flow de xuat:

1. Lay lock theo order.
2. Lay lock theo danh sach asset unit duoc gan.
3. Check asset unit ton tai, dung product, khong bi maintenance/lost/retired.
4. Check overlap bang DB.
5. Update rental order items trong transaction.
6. Invalidate dashboard/availability cache.
7. Publish event `events:rental-order`.
8. Release lock.

### 8.7 Dashboard metrics

Flow de xuat:

1. API dashboard doc cache `dashboard:metrics:*`.
2. Neu cache miss, query DB va `setJson` voi TTL ngan.
3. Khi order/product/asset unit thay doi, xoa cac key dashboard lien quan.
4. Neu co socket, publish `events:dashboard` de frontend reload data.

### 8.8 Realtime dashboard/socket

Khi can realtime:

1. Backend service publish event sau transaction thanh cong.
2. Socket gateway subscribe Redis channel.
3. Gateway emit den room/admin clients.
4. Neu co nhieu backend instance, Redis pub/sub giup moi instance deu nhan event.

Event payload chi nen gom thong tin toi thieu:

```json
{
  "type": "ORDER_STATUS_CHANGED",
  "orderId": "uuid",
  "status": "CONFIRMED",
  "occurredAt": "2026-07-01T00:00:00.000Z"
}
```

Client nen goi API lay chi tiet moi neu can data day du.

---

## 9. Ke hoach trien khai

### Phase 1 - Mo rong wrapper an toan

- Bo sung `getJson`, `setJson`, `mgetJson`, `msetJson`, `setJsonKeepTTL`.
- Bo sung `incrWithTTL`, `expire`.
- Bo sung `scanKeys`, `deleteByPattern` bang `SCAN`.
- Bo sung prefix/TTL/channel vao `constant/prefix.constant.ts`.
- Bo sung key builders vao `redis-key.constant.ts` dua tren `REDIS_PREFIX`.
- Viet unit test cho parse JSON loi, TTL, delete empty keys, counter TTL.

### Phase 2 - Auth/security

- Luu auth session va refresh token hash tren Redis.
- Rotate refresh token moi lan refresh.
- Revoke current session khi logout va revoke all khi doi/reset password.
- Them rate limit cho reset password.
- Them login failed counter.
- Them temporary lock neu dung Redis lock tam thoi.
- Dam bao login thanh cong xoa counter.

### Phase 3 - Rental order concurrency

- Build `acquireLock`, `releaseLock`, `withLock`.
- Boc `confirmRentalOrder`.
- Boc `assignRentalOrderAssets`.
- Boc cac action transition status sau nay.
- Test case: 2 request confirm/assign cung luc chi 1 request thanh cong.

### Phase 4 - Dashboard cache

- Tao service cache cho dashboard metrics.
- Dinh nghia invalidation khi order/asset/product thay doi.
- Them TTL ngan 30-120 giay.
- Test cache hit/miss va invalidate.

### Phase 5 - Pub/Sub realtime

- Them Redis publisher/subscriber.
- Tao event channel constants.
- Socket gateway subscribe va emit.
- Publish sau cac transaction thanh cong.
- Test multi-instance bang cach chay 2 backend instance neu can.

---

## 10. De xuat cau truc code

```text
src/libs/redis/
  redis.module.ts
  redis.service.ts
  constant/
    prefix.constant.ts
  redis-key.constant.ts
  redis-lock.service.ts
  redis-cache.service.ts
```

Y nghia:

- `RedisService`: wrapper ioredis cap thap.
- `RedisLockService`: lock/idempotency.
- `RedisCacheService`: remember/invalidate/cache JSON.
- `constant/prefix.constant.ts`: Redis prefix, channel va TTL dung chung.
- `redis-key.constant.ts`: key builder dua tren `REDIS_PREFIX`.

Feature module nen inject service dung muc dich:

- Auth inject `RedisService` hoac `RedisCacheService`.
- RentalOrders inject `RedisLockService` va `RedisCacheService`.
- Dashboard inject `RedisCacheService`.
- Socket gateway inject Redis pub/sub service khi co realtime.

---

## 11. Acceptance criteria

- Tat ca Redis prefix duoc khai bao qua `REDIS_PREFIX`.
- Tat ca Redis key duoc tao qua `REDIS_KEYS`, khong hard-code key trong service nghiep vu.
- Khong dung `KEYS` trong production code; dung `SCAN`.
- Cac cache quan trong deu co TTL.
- Cac lock co token va release atomic.
- Confirm/assign order van check availability bang DB trong transaction flow.
- Redis fail khong duoc lam mat du lieu nghiep vu; tru cache/realtime co the degrade graceful.
- Co test cho lock, cache invalidation, counter/rate-limit.
