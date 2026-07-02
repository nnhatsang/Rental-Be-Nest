# Auth Session Redis & RBAC Permission Cache

> Huong dan cach backend Rental Admin dung Redis cho phien dang nhap, refresh token rotation, revoke session, login security va dinh huong cache RBAC permissions cho phase sau.

---

## 1. Tong quan

Auth hien tai dung mo hinh:

```text
JWT HttpOnly cookies + Redis session store + PostgreSQL user/RBAC source of truth
```

Y nghia:

- Access token va refresh token van nam trong cookie HttpOnly.
- JWT payload co `sub` va `sid`.
- Redis luu session theo `sid`, refresh token hash va metadata thiet bi.
- PostgreSQL van la source of truth cho user, roles va permissions.

Redis khong luu raw refresh token va khong luu permissions trong phase hien tai.

---

## 2. `sub` va `sid`

JWT payload dung 2 field quan trong:

```ts
type JwtAccessPayload = {
  sub: string;
  email: string;
  sid: string;
  type: 'access';
};

type JwtRefreshPayload = {
  sub: string;
  sid: string;
  type: 'refresh';
};
```

Trong do:

- `sub`: subject, la `userId`.
- `sid`: session id, la id cua mot phien dang nhap cu the.

Mot user co the co nhieu session:

```text
User A
- Laptop: auth:session:<sid-1>
- Phone: auth:session:<sid-2>
```

Logout tren laptop chi xoa `sid-1`. Reset password/change password se xoa tat ca session cua user.

---

## 3. Redis keys

Tat ca key phai duoc tao qua `REDIS_KEYS` trong `src/libs/redis/redis-key.constant.ts`.

Auth session keys:

```ts
REDIS_KEYS.auth.session(sessionId)
// auth:session:<sessionId>

REDIS_KEYS.auth.userSessions(userId)
// auth:user-sessions:<userId>
```

Security/rate limit keys:

```ts
REDIS_KEYS.auth.loginAttemptUser(userId)
REDIS_KEYS.auth.loginAttemptEmail(normalizedEmail)
REDIS_KEYS.auth.userLock(userId)
REDIS_KEYS.auth.resetPasswordRateLimit(emailOrUserId)
```

RBAC cache keys cho phase sau:

```ts
REDIS_KEYS.rbac.userPermissions(userId)
REDIS_KEYS.rbac.rolePermissions(roleId)
```

---

## 4. Session payload

Redis key `auth:session:<sessionId>` luu JSON:

```json
{
  "sessionId": "uuid",
  "userId": "uuid",
  "refreshTokenHash": "sha256-hmac-hex",
  "createdAt": "2026-07-02T00:00:00.000Z",
  "lastUsedAt": "2026-07-02T00:00:00.000Z",
  "expiresAt": "2026-07-09T00:00:00.000Z",
  "ipAddress": "192.168.0.1",
  "userAgent": "Mozilla/5.0 ...",
  "deviceId": "device-id",
  "fcmToken": "push-token"
}
```

Quy tac bao mat:

- Chi luu `refreshTokenHash`, khong luu raw refresh token.
- Hash refresh token bang HMAC SHA-256 voi secret server-side.
- TTL cua session bang `JWT_REFRESH_EXPIRES_IN`.
- `auth:user-sessions:<userId>` la Redis Set chua cac `sessionId` cua user.

---

## 5. Login flow

Endpoint:

```text
POST /admin/auth/login
```

Controller nhan `LoginDto` co cac field metadata optional:

```ts
ipAddress?: string;
userAgent?: string;
deviceId?: string;
captchaToken?: string;
fcmToken?: string;
```

Controller resolve metadata:

```ts
dto.userAgent = dto.userAgent || request.headers['user-agent']?.toString() || '';
dto.ipAddress = getIp(request) || dto.ipAddress;
```

Service flow:

1. Normalize email.
2. Validate user ton tai, khong deleted, status `ACTIVE`.
3. Check Redis temporary lock.
4. Compare password.
5. Tao `sessionId`.
6. Issue access token va refresh token co `sid`.
7. Hash refresh token.
8. Luu `auth:session:<sid>` va add `sid` vao `auth:user-sessions:<userId>`.
9. Set cookies:
   - `admin_access_token`
   - `admin_refresh_token`

Neu login sai:

- Tang `auth:login-attempt:email:<email>`.
- Neu user ton tai thi tang them `auth:login-attempt:user:<userId>`.
- Vuot nguong thi set `auth:lock:user:<userId>` va cap nhat DB `activityStatus = LOCKED`.

---

## 6. Access token validation

Strategy:

```text
src/modules/auth/strategies/jwt-access.strategy.ts
```

Trach nhiem cua strategy:

1. Doc cookie `admin_access_token`.
2. Verify JWT bang `JWT_ACCESS_SECRET`.
3. Bat buoc payload:
   - `type === 'access'`
   - co `sub`
   - co `sid`
4. Goi `AuthService.validateAccessUser(payload.sub, payload.sid, isLogout)`.

`AuthService.validateAccessUser` moi la noi check Redis va DB:

1. Load `auth:session:<sid>`.
2. Session phai ton tai va `session.userId === sub`.
3. Query DB user + roles + permissions.
4. User phai ton tai, chua deleted, va neu khong phai logout thi phai `ACTIVE`.
5. Tra ve `AuthUser` gan vao `request.user`.

Ghi chu:

- `sessionId` co trong `request.user` de logout dung phien.
- `sessionId` duoc set non-enumerable de khong bi tra ra JSON response.
- Permissions hien van doc tu DB moi request.

---

## 7. Refresh token rotation

Strategy:

```text
src/modules/auth/strategies/jwt-refresh.strategy.ts
```

Trach nhiem cua strategy:

1. Doc cookie `admin_refresh_token`.
2. Verify JWT bang `JWT_REFRESH_SECRET`.
3. Bat buoc payload:
   - `type === 'refresh'`
   - co `sub`
   - co `sid`
4. Tra ve payload kem raw refresh token:

```ts
return {
  ...payload,
  refreshToken,
};
```

`AuthService.refresh` flow:

1. Load Redis session bang `sid`.
2. Session phai ton tai va thuoc dung `sub`.
3. Hash raw refresh token tu cookie.
4. So sanh hash voi `session.refreshTokenHash`.
5. Neu hop le, issue cap access/refresh moi cung `sid`.
6. Update Redis session:
   - `refreshTokenHash` moi
   - `lastUsedAt` moi
   - TTL moi
7. Set cookies moi.

Neu refresh token cu duoc dung lai sau khi da rotate, hash se khong match va request bi reject bang `INVALID_SESSION`.

---

## 8. Logout va revoke sessions

Logout current session:

```text
POST /admin/auth/logout
```

Flow:

1. Access guard validate token va Redis session.
2. `request.user.sessionId` duoc truyen vao `AuthService.logout`.
3. Xoa `auth:session:<sid>`.
4. Remove `sid` khoi `auth:user-sessions:<userId>`.
5. Clear auth cookies.

Revoke all sessions:

- Dung sau `changePassword`.
- Dung sau `resetPassword`.
- Nen dung khi admin ban/lock/delete user.

Flow:

1. Lay Redis Set `auth:user-sessions:<userId>`.
2. Xoa tat ca `auth:session:<sid>`.
3. Xoa `auth:user-sessions:<userId>`.

---

## 9. Password reset va rate limit

Password reset token van la flow rieng:

```ts
REDIS_KEYS.auth.passwordResetToken(tokenHash)
REDIS_KEYS.auth.passwordResetUser(userId)
```

Quy tac:

- Raw reset token chi gui qua email.
- Redis chi luu hash/payload.
- Moi user chi co mot reset token active.
- Consume xong xoa token key va user key.

Rate limit forgot password:

```ts
REDIS_KEYS.auth.resetPasswordRateLimit(normalizedEmail)
```

Neu vuot gioi han, API van tra `{ success: true }` de khong lo email co ton tai hay khong.

---

## 10. RBAC permissions va Redis

Hien tai `validateAccessUser` khong luu permissions vao Redis.

Flow hien tai:

```text
Access token -> Redis session check -> DB user roles permissions -> request.user
```

Ly do chua cache permissions:

- Permissions la du lieu nhay cam.
- Neu cache stale, user co the tiep tuc dung quyen da bi thu hoi.
- Can invalidate day du truoc khi bat cache.

Khi can toi uu, co the cache:

```ts
REDIS_KEYS.rbac.userPermissions(userId)
REDIS_KEYS.rbac.rolePermissions(roleId)
```

Payload:

```json
{
  "userId": "uuid",
  "roles": ["ADMIN"],
  "permissions": ["orders.read", "orders.create"],
  "cachedAt": "2026-07-02T00:00:00.000Z"
}
```

Dieu kien bat cache:

1. Invalidate user permission cache khi gan/xoa role cua user.
2. Invalidate tat ca user thuoc role khi role permission thay doi.
3. Invalidate khi user bi `BANNED`, `LOCKED`, `INACTIVE`, soft delete hoac hard delete.
4. TTL ngan, 5-15 phut.
5. DB van la source of truth khi cache miss.

Khuyen nghi:

- Chua bat RBAC cache neu traffic chua lon.
- Neu bat cache, viet test invalidate truoc.

---

## 11. Socket authentication

Socket gateway doc `admin_access_token` tu handshake cookie.

Flow:

1. Verify access JWT.
2. Bat buoc payload co `sid`.
3. Check `auth:session:<sid>` trong Redis.
4. Session phai thuoc dung `payload.sub`.
5. Join room `user:<userId>`.

Neu session bi revoke, socket moi khong connect duoc. Cac socket dang ket noi can them event logout/revoke realtime neu muon cat ngay lap tuc.

---

## 12. Checklist khi sua auth/redis

- Khong luu raw refresh token vao Redis.
- Moi access/refresh JWT phai co `sid`.
- Strategy chi validate token va goi service, khong ghi Redis.
- AuthService la noi tao/rotate/revoke session.
- Logout chi revoke current session.
- Change/reset password revoke all sessions.
- Permissions van doc DB cho den khi co cache invalidate day du.
- Moi Redis key phai di qua `REDIS_KEYS`.
- Redis TTL cua session phai khop refresh token max age.

