# Quy chuẩn phát triển Backend (NestJS Conventions)

> Tài liệu hướng dẫn lập trình, tổ chức thư mục, và các nguyên tắc phát triển code ở phía Backend NestJS.

---

## 1. Cấu trúc Mô-đun (Module Structure)

Mỗi mô-đun nghiệp vụ (Business Module) phải được đặt trong thư mục `src/modules/<resource_plural>/` (tên thư mục ở số nhiều) và tuân thủ cấu trúc phân cấp sau:

```text
src/modules/<resource>/
  dto/
    create-<resource>.dto.ts      ← DTO nhận dữ liệu đầu vào khi tạo mới
    update-<resource>.dto.ts      ← DTO nhận dữ liệu đầu vào khi cập nhật
    <resource>-out.dto.ts         ← DTO định nghĩa cấu trúc dữ liệu thô xuất ra
    <resource>-response.dto.ts    ← DTO wrapper chứa ApiRes định dạng trả về Swagger
  <resource>.controller.ts        ← Xử lý luồng HTTP và request/response
  <resource>.service.ts           ← Xử lý logic nghiệp vụ và truy vấn DB
  <resource>.module.ts            ← Khai báo NestJS Module và các dependency injection
```

---

## 2. Quy định Trách nhiệm (Separation of Concerns)

### 2.1 Controller (Tầng HTTP)
Controller **chỉ xử lý các vấn đề liên quan đến HTTP**:
- Định nghĩa Route path, Swagger Decorator (`@ApiTags`, `@ApiOkResponse`,...).
- Áp dụng các Guard bảo mật và phân quyền (`@UseGuards(JwtAuthGuard)`, `@RequirePermissions(...)`).
- Ràng buộc kiểu dữ liệu đầu vào (Request DTOs).
- Định dạng dữ liệu trả về thông qua các DTO phản hồi chung (`ApiRes`, `ApiNullableRes`, `ApiPaginatedResponseDto`).
- Đọc/ghi cookie (ví dụ: set auth token cookie tại endpoint đăng nhập).

*Controller KHÔNG chứa bất kỳ logic nghiệp vụ hoặc gọi trực tiếp Prisma Client.*

### 2.2 Service (Tầng Nghiệp vụ)
Service **chỉ xử lý logic nghiệp vụ và giao tiếp database**:
- Truy vấn PostgreSQL thông qua Prisma Service (`PrismaService`).
- Kiểm tra tính hợp lệ dữ liệu phụ thuộc vào database (ví dụ: email đã tồn tại chưa, thiết bị có bị trùng lịch thuê không).
- Thực thi các transaction phức tạp (`prisma.$transaction`).
- Thực hiện chuyển trạng thái đơn hàng và kích hoạt cập nhật trạng thái thiết bị.
- Áp dụng các công thức tính toán giá thuê.
- Map các Prisma Entity sang Output DTO trước khi trả về Controller.

*Service KHÔNG được thao tác với request/response object, không set cookie, không tự động đóng gói dữ liệu trong `ApiRes`, và không hardcode mã lỗi tiếng Việt (phải dùng hệ thống mã lỗi chung).*

---

## 3. Quy chuẩn viết DTO (Data Transfer Objects)

- **Input DTOs**: Chỉ mô tả các trường do Client gửi lên. Tuyệt đối không chứa các trường tự sinh ở Server hoặc nhạy cảm như: `id`, `createdAt`, `updatedAt`, `deletedAt`, `passwordHash`, `refreshTokenHash`.
- **Output DTOs**: Định nghĩa chính xác định dạng dữ liệu trả về cho client. Tuyệt đối không trả nguyên bản Prisma Model (Entity) ra client để tránh lộ thông tin nhạy cảm.
- **Swagger Properties**: Sử dụng toán tử `!` hoặc `declare` để tránh cảnh báo strict property initialization trong TypeScript:
  ```typescript
  id!: string;
  declare email: string;
  ```

---

## 4. Quản lý lỗi hệ thống (System Error Handling)

- Không tự viết thông báo lỗi thô (String) hoặc ném lỗi trực tiếp bằng `InternalServerErrorException('Lỗi...')` trong Service.
- Mọi mã lỗi nghiệp vụ phải được định nghĩa tập trung tại file [src/libs/constants/error.constants.ts](file:///d:/Admin%20Rental/rental-admin-be/src/libs/constants/error.constants.ts).
- Ví dụ ném lỗi trong Service:
  ```typescript
  throw new BadRequestException(ERROR_CODES.USER_BANNED);
  ```

---

## 5. Quy tắc tìm kiếm tiếng Việt không dấu (Accent-Insensitive Search)

Như đã mô tả trong cấu trúc DB, để tối ưu hóa hiệu năng tìm kiếm tiếng Việt (accent-insensitive):
- Backend cung cấp hàm tiện ích chuẩn hóa chuỗi tại `src/libs/utils/search-text.util.ts`.
- Khi nhân viên tạo mới hoặc cập nhật thông tin (ví dụ: cập nhật tên khách hàng `Customer`), Service phải chuẩn hóa thông tin này và lưu vào cột `searchText`.
- Khi thực hiện tìm kiếm, Service sẽ truy vấn bằng cú pháp:
  ```typescript
  where: {
    searchText: {
      contains: normalizedKeyword,
    }
  }
  ```
  *(Truy vấn này sẽ tự động tận dụng Index trigram GIN của PostgreSQL đã khai báo trong Prisma).*

---

## 6. Quy chuẩn WebSocket (WebSocket Gateways)

Khi triển khai các mô-đun kết nối thời gian thực bằng WebSockets, backend phải tuân thủ các quy tắc sau:

### 6.1 Tổ chức thư mục
Các file liên quan đến WebSocket nằm tại một mô-đun chung:
```text
src/modules/socket/
  socket.gateway.ts       ← Định nghĩa WebSocket Gateway, xử lý connect/disconnect/handshake
  socket.service.ts       ← Cung cấp helper gửi message từ các module HTTP khác qua socket
  socket.module.ts        ← Khai báo Provider và xuất bản SocketService
```

### 6.2 Trách nhiệm của Gateway & Service
- **`SocketGateway`**:
  - Lắng nghe kết nối và xử lý xác thực token JWT lúc handshake.
  - Quản lý Client Connection, đăng ký người dùng vào room `user:<userId>`.
  - Sử dụng `@WebSocketGateway({ cors: { origin: ... } })` và cấu hình CORS chặt chẽ.
- **`SocketService`**:
  - Đóng vai trò là cầu nối (Bridge). Các mô-đun khác (ví dụ: `UsersService`, `RolesService`) tuyệt đối không được inject trực tiếp `SocketGateway` để tránh lỗi phụ thuộc vòng (Circular Dependency).
  - Các service nghiệp vụ sẽ gọi `SocketService.sendToUser(userId, eventName, data)` hoặc `SocketService.sendToUsers(userIds, eventName, data)`.

### 6.3 Xử lý Ngoại lệ (Exception Handling)
- Không ném lỗi Http (`HttpException`, `BadRequestException`) trực tiếp trong Gateway vì client socket không nhận được mã lỗi HTTP chuẩn.
- Bắt buộc dùng `WsException` từ `@nestjs/websockets` để ném lỗi socket:
  ```typescript
  throw new WsException(ERROR_CODES.UNAUTHORIZED);
  ```

