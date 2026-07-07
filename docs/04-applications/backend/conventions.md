# Quy chuẩn phát triển Backend (NestJS Conventions)

> Tài liệu hướng dẫn tổ chức module, DTO, service, auth/session, Redis, Prisma và các nguyên tắc phát triển backend NestJS cho Rental Admin.

---

## 1. Cấu trúc module

Mỗi module nghiệp vụ đặt trong `src/modules/<resource_plural>/` và tuân thủ cấu trúc cơ bản:

```text
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

Quy ước:

- Controller xử lý HTTP, guard, Swagger, cookie, request/response mapping.
- Service xử lý nghiệp vụ, Prisma query, Redis/session/cache và transaction.
- DTO không chứa logic nghiệp vụ.
- Không gọi Prisma trực tiếp từ controller.

---

## 2. Controller và Service

### 2.1 Controller

Controller chỉ xử lý tầng HTTP:

- Định nghĩa route, method, status code.
- Gắn Swagger decorators.
- Gắn guards và permission decorators.
- Nhận input DTO và current user/request metadata.
- Set/clear cookie nếu endpoint liên quan auth.
- Trả dữ liệu qua response DTO/wrapper chuẩn.

Controller không chứa logic nghiệp vụ và không gọi Prisma trực tiếp.

### 2.2 Service

Service xử lý nghiệp vụ:

- Query/update database qua `PrismaService`.
- Kiểm tra dữ liệu phụ thuộc DB.
- Chạy transaction khi có nhiều write liên quan nhau.
- Gọi Redis/session/cache helper khi cần.
- Map Prisma entity sang output DTO trước khi trả về controller.

Service không thao tác trực tiếp `Request`/`Response`, không set cookie, không hard-code message tiếng Việt.

---

## 3. DTO và response

### 3.1 Input DTO

Input DTO chỉ mô tả field client được phép gửi.

Không đưa field server-generated hoặc nhạy cảm vào input DTO:

- `id`
- `createdAt`
- `updatedAt`
- `deletedAt`
- `passwordHash`
- `refreshTokenHash`

Mỗi field public trong DTO cần có:

- `@ApiProperty` hoặc `@ApiPropertyOptional`
- validator từ `class-validator`
- message lỗi dùng constants nếu dự án đã có constant tương ứng

Ví dụ login metadata optional:

```ts
@ApiProperty({ type: String, example: '192.168.0.1', required: false })
@IsOptional()
@IsString({ message: INVALID_STRING })
ipAddress?: string;

@ApiProperty({ type: String, example: 'Iphone 15', required: false })
@IsOptional()
@IsString({ message: INVALID_STRING })
userAgent?: string;

@ApiProperty({ type: String, example: 'device-id', required: false })
@IsOptional()
@IsString({ message: INVALID_STRING })
deviceId?: string;
```

### 3.2 Output DTO

Output DTO định nghĩa đúng dữ liệu trả về client.

Không trả raw Prisma model ra client. Không trả field nhạy cảm như password hash, refresh token hash, internal lock fields nếu client không cần.

### 3.3 Response wrapper

Controller trả response qua wrapper/DTO chuẩn của dự án, ví dụ:

- `ApiRes`
- `ApiNullableRes`
- `ApiPaginatedResponseDto`

Service chỉ trả data nghiệp vụ, controller chịu trách nhiệm đóng gói response nếu pattern module đang làm như vậy.

---

## 4. Error handling

Không hard-code message lỗi tiếng Việt trong service.

Mã lỗi nghiệp vụ phải định nghĩa tập trung tại:

```text
src/libs/constants/error.constants.ts
```

Ví dụ:

```ts
throw new BadRequestException(ERROR_CODES.USER_BANNED);
```

Quy ước:

- Thêm error code trước khi dùng ở service/guard/strategy.
- Dùng exception phù hợp ngữ cảnh: `BadRequestException`, `UnauthorizedException`, `ForbiddenException`, `NotFoundException`.
- Không dùng `InternalServerErrorException` cho lỗi nghiệp vụ có thể dự đoán.

---

## 5. Auth JWT cookie và Redis session

Auth dùng mô hình:

```text
JWT HttpOnly cookies + Redis session store + PostgreSQL user/RBAC source of truth
```

Quy ước bắt buộc:

- Access token và refresh token nằm trong HttpOnly cookie.
- JWT payload phải có `sub` và `sid`.
- `sub` là `userId`.
- `sid` là session id của một phiên đăng nhập cụ thể.
- Redis lưu session, refresh token hash và metadata thiết bị.
- Không lưu raw refresh token trong Redis hoặc database.

Payload chuẩn:

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

Login flow:

- Controller resolve `ipAddress` và `userAgent` từ request nếu body không truyền.
- Service validate credentials.
- Service tạo `sessionId`.
- Issue access/refresh token có `sid`.
- Hash refresh token bằng HMAC SHA-256.
- Lưu session vào Redis.
- Set cookies ở controller.

Refresh flow:

- Strategy lấy raw refresh token từ cookie.
- Service load Redis session theo `sid`.
- Compare refresh token hash.
- Rotate refresh token và update hash/TTL.

Logout/revoke:

- Logout chỉ xóa session hiện tại.
- Reset password/change password phải revoke toàn bộ sessions của user.

Chi tiết auth session nằm tại:

```text
docs/03-domains/rbac/auth-session-and-permission-cache.md
```

---

## 6. Redis conventions

Mọi Redis key phải tạo qua Redis key constants/helper của dự án. Không hard-code key trong service.

Quy ước prefix:

- `auth:*` cho auth session, login attempt, lock, reset password rate limit.
- `rbac:*` cho permission/role cache phase sau.
- `cache:*` cho cache dữ liệu nghiệp vụ.
- `rate-limit:*` cho rate limit tổng quát nếu có.

Mỗi Redis value cần xác định rõ:

- Key pattern.
- Value shape.
- TTL.
- Khi nào set/update/delete.
- Ai chịu trách nhiệm cleanup.

Auth session keys:

```ts
REDIS_KEYS.auth.session(sessionId)
REDIS_KEYS.auth.userSessions(userId)
```

Không lưu permission vào Redis trong phase hiện tại nếu chưa có invalidation strategy rõ ràng.

---

## 7. Pagination, filter, sort và search

List endpoint nên dùng params chuẩn:

```ts
page?: number;
perPage?: number;
search?: string;
sortBy?: string;
sort?: 'asc' | 'desc';
```

Filter theo domain thêm field riêng, ví dụ:

```ts
status?: UserActivityStatus;
roleCode?: string;
```

Quy ước:

- `page` ở API là base 1.
- `perPage` có default và giới hạn max.
- `sortBy` phải whitelist theo field cho phép sort.
- `sort` dùng `asc` cho ascending và `desc` cho descending.
- Default chung là `sort=desc`; từng module đặt default `sortBy` để giữ hành vi list hiện tại.
- Không truyền trực tiếp `sortBy` từ client vào Prisma nếu chưa validate whitelist.

Danh sách `sortBy` đang hỗ trợ cho các endpoint phân trang:

| Endpoint | Default | `sortBy` hỗ trợ |
|---|---|---|
| `GET /users` | `createdAt` | `createdAt`, `fullName`, `email`, `activityStatus` |
| `GET /products` | `createdAt` | `createdAt`, `updatedAt`, `name`, `sku`, `dailyPrice`, `depositAmount`, `isActive` |
| `GET /customers` | `createdAt` | `createdAt`, `updatedAt`, `code`, `name`, `phone`, `email`, `status` |
| `GET /asset-units` | `createdAt` | `createdAt`, `updatedAt`, `serialNumber`, `status`, `condition`, `isActive` |
| `GET /rental-orders` | `createdAt` | `createdAt`, `updatedAt`, `code`, `startDate`, `endDate`, `status`, `paymentStatus`, `upfrontTotal`, `remainingTotal` |
| `GET /roles` | `isSystem` | `isSystem`, `code`, `name`, `createdAt`, `updatedAt` |
| `GET /store-closures` | `startDate` | `startDate`, `endDate`, `type`, `createdAt`, `updatedAt` |

Ví dụ:

```http
GET /users?page=1&perPage=20&sortBy=email&sort=asc
GET /rental-orders?sortBy=startDate&sort=desc
```

Search tiếng Việt không dấu:

- Entity có nhu cầu search nên có field `searchText` nếu schema đã hỗ trợ.
- Khi create/update dữ liệu liên quan, service chuẩn hóa và lưu `searchText`.
- Khi search, normalize keyword rồi query theo `contains`.

Ví dụ:

```ts
where: {
  searchText: {
    contains: normalizedKeyword,
  },
}
```

---

## 8. Prisma query và transaction

Prisma query cần rõ ràng và tránh leak dữ liệu:

- Dùng `select` cho list/detail khi có field nhạy cảm.
- Chỉ dùng `include` khi thật sự cần quan hệ đầy đủ.
- Không trả Prisma entity trực tiếp ra controller/client.
- Mapping entity sang DTO đặt ở service/helper.

Transaction:

- Dùng `prisma.$transaction` cho flow có nhiều write phụ thuộc nhau.
- Ví dụ: reset password + revoke sessions, change password + revoke sessions, update status + side effect liên quan.
- Không gọi external service khó rollback bên trong transaction nếu không cần thiết.

---

## 9. Guards, permissions và RBAC

Protected endpoint phải dùng JWT guard.

Endpoint yêu cầu quyền phải dùng permission decorator/guard của dự án, ví dụ:

```ts
@RequirePermissions(...)
```

Quy ước:

- Không check permission thủ công rải rác trong service nếu guard/decorator xử lý được.
- Service vẫn có thể kiểm tra ownership/business rule nếu đó là rule nghiệp vụ, không phải permission tĩnh.
- User bị `LOCKED`, `BANNED`, `INACTIVE` không được access protected API dù Redis session còn.

RBAC permission cache trong Redis là phase sau; chỉ triển khai khi có invalidation strategy cho role/permission/user-role changes.

---

## 10. WebSocket conventions

Module socket dùng cấu trúc:

```text
src/modules/socket/
  socket.gateway.ts
  socket.service.ts
  socket.module.ts
```

Quy ước:

- Gateway xử lý connect/disconnect/handshake.
- Gateway xác thực token khi handshake nếu socket yêu cầu auth.
- Client được join room theo pattern `user:<userId>`.
- Module nghiệp vụ không inject trực tiếp `SocketGateway`; gọi qua `SocketService`.
- Trong Gateway, dùng `WsException`, không throw `HttpException`.

Ví dụ:

```ts
throw new WsException(ERROR_CODES.UNAUTHORIZED);
```

---

## 11. Verification

Sau khi sửa backend, chạy kiểm tra phù hợp tại root backend.

Khuyến nghị tối thiểu:

```bash
pnpm run build
```

Nếu module có test:

```bash
pnpm test
```

Khi sửa auth/redis/session, cần kiểm tra các scenario:

- Login tạo session Redis và set cookie.
- Refresh token rotate hash.
- Refresh token cũ bị reject sau rotation.
- Logout chỉ xóa session hiện tại.
- Reset/change password revoke toàn bộ sessions.
- Protected API reject nếu session Redis đã bị xóa.
- User locked/banned/inactive bị reject dù JWT còn hạn.

Không commit code khi build/typecheck fail.
