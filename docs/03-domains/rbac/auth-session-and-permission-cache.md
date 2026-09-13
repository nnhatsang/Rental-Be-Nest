# Auth Session Redis & RBAC Permission Cache

> Huong dan cach backend Rental Admin dung Redis cho phien dang nhap, refresh token rotation, revoke session, login security va RBAC permission cache theo user.

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

Redis khong luu raw refresh token. RBAC luu effective roles/permissions theo user voi TTL ngan va PostgreSQL van la source of truth.

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
REDIS_KEYS.auth.resetPasswordRateLimit(emailOrUserId)
```

RBAC cache key:

```ts
REDIS_KEYS.rbac.userPermissions(userId)
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
- Khi counter theo user dat nguong, cac lan login tiep theo bi tu choi cho den khi TTL counter het han.

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
3. Query DB user/status.
4. Doc effective roles/permissions tu RBAC cache theo user; cache miss thi query DB quan he RBAC va set lai cache.
5. User phai ton tai, chua deleted, va neu khong phai logout thi phai `ACTIVE`.
6. Tra ve `AuthUser` gan vao `request.user`.

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

Flow hien tai:

```text
Access token
  -> Redis session check
  -> DB user/status check
  -> Redis rbac:user-permissions:<userId>
  -> cache miss: DB UserRole/Role/RolePermission/Permission + SET cache
  -> request.user
  -> PermissionsGuard
```

Chi cache effective authorization theo user, khong cache rieng theo role. PostgreSQL van la source of truth; Redis chi la cache tam thoi voi TTL 10 phut.

Payload:

```json
{
  "userId": "uuid",
  "roles": ["ADMIN"],
  "permissions": ["orders.read", "orders.create"],
  "cachedAt": "2026-07-02T00:00:00.000Z"
}
```

Cache miss va Redis error:

- Cache miss query PostgreSQL roi ghi lai cache voi TTL `RBAC_USER_PERMISSION_CACHE`.
- Redis GET/SET loi khong lam request authorization that bai; dung ket qua PostgreSQL.
- Cache JSON sai format bi xoa best-effort va load lai tu PostgreSQL.

Invalidation sau DB commit:

1. Invalidate khi gan/xoa role cua user.
2. Invalidate tat ca user thuoc role khi role code hoac role permission thay doi.
3. Invalidate user cua role truoc khi role bi xoa.
4. Invalidate khi user doi activity status hoac bi soft delete.
5. TTL 10 phut; neu invalidation that bai, cache cu ton tai toi da theo TTL.

Socket event `permissions:updated` chi de frontend refetch `/auth/me`; backend khong tin vao event nay de authorize request.

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
