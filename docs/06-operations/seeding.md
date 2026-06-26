# Thiết lập Cơ sở dữ liệu & Seed dữ liệu mẫu (Seeding Guide)

> Tài liệu hướng dẫn thiết lập cơ sở dữ liệu ban đầu, chạy các công cụ seed dữ liệu hệ thống (Hệ thống phân quyền, Vai trò mặc định, Khung giờ mở cửa, và Chính sách thuê).

---

## 1. Bản ghi dữ liệu hệ thống (System Seed Metadata)

Khi khởi chạy cơ sở dữ liệu lần đầu, hệ thống cần được nạp các cấu hình nền tảng. Các file seed này nằm trong thư mục `src/migration/seeder/` của backend.

### Dữ liệu được seed mặc định bao gồm:
1. **Catalog Permissions**: Nạp toàn bộ danh mục mã quyền (`orders.read`, `products.create`...) vào bảng `Permission`.
2. **System Roles**: Khởi tạo 4 vai trò mặc định: `ADMIN`, `MANAGER`, `STAFF`, `VIEWER`.
3. **RolePermission Association**: Gán toàn bộ danh mục quyền tương ứng cho từng vai trò theo cấu trúc bảng phân quyền RBAC.
4. **Default Admin User**: Khởi tạo một tài khoản quản trị viên tối cao ban đầu để đăng nhập hệ thống.
5. **Default Rental Policy**: Cấu hình chính sách cho thuê mặc định (mã `DEFAULT`), thiết lập:
   - Tiền giữ máy mặc định mỗi thiết bị: `50,000 VND`.
   - Thời gian đệm dọn dẹp giữa hai đơn thuê: `60 phút`.
6. **Store Business Hours**: Khởi tạo lịch mở cửa mặc định cho cửa hàng từ Thứ Hai đến Chủ Nhật (mặc định mở cửa từ `08:00` đến `20:00`).

---

## 2. Cách thiết lập tài khoản Admin mặc định qua ENV

Trước khi chạy seed dữ liệu, lập trình viên hoặc kỹ sư vận hành có thể thiết lập thông tin đăng nhập của Admin mặc định thông qua các biến môi trường trong file `.env`:

```env
# Thông tin tài khoản Admin hệ thống khi seed
SEED_ADMIN_EMAIL=admin@rental.local
SEED_ADMIN_PASSWORD=Password123!
SEED_ADMIN_FULL_NAME=System Admin
```

> [!WARNING]
> Mật khẩu Admin mặc định bắt buộc phải tuân thủ quy tắc độ phức tạp (chữ hoa, chữ thường, số, ký tự đặc biệt) để vượt qua bộ lọc validate dữ liệu đầu vào.

---

## 3. Lệnh chạy Seed dữ liệu

### 3.1 Chạy seed độc lập
Chạy lệnh sau tại thư mục gốc backend để nạp dữ liệu mẫu vào cơ sở dữ liệu đã có sẵn cấu trúc bảng (sau khi migrate):
```bash
pnpm db:seed
```

### 3.2 Khởi tạo toàn bộ Database (Khuyên dùng cho dev mới setup máy)
Lệnh gộp tự động chạy migrate cơ sở dữ liệu từ đầu, khởi tạo client Prisma, và tự động chạy seed:
```bash
pnpm db:setup
```

*Lưu ý: Không được import module seeder hoặc tự động chạy seed khi ứng dụng NestJS khởi động bình thường (`AppModule` khởi chạy) để tránh xung đột dữ liệu và làm chậm quá trình khởi động máy chủ.*
