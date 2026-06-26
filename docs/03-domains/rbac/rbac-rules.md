# Quy định Phân quyền & Bản đồ Quyền hạn (RBAC & Permissions)

> Tài liệu mô tả chi tiết mô hình phân quyền Role-Based Access Control (RBAC) của hệ thống, danh mục mã quyền (Permissions), và thiết lập mặc định của các Vai trò (Roles).

---

## 1. Mô hình Phân quyền động

Hệ thống Rental Admin sử dụng phân quyền động dựa trên cơ sở dữ liệu (Database-driven RBAC). Thay vì kiểm tra vai trò cứng bằng chuỗi (ví dụ: `if (user.role === 'ADMIN')`), hệ thống kiểm tra mã quyền chi tiết được gán cho các vai trò đó.

### Sơ đồ liên kết thực thể (ERD)
- Một **Người dùng** (`User`) có thể được gán nhiều **Vai trò** (`Role`) thông qua bảng trung gian `UserRole`.
- Một **Vai trò** (`Role`) được cấp một danh sách **Quyền** (`Permission`) thông qua bảng trung gian `RolePermission`.
- **Mã quyền** (`Permission.code`) là chuỗi ký tự duy nhất dạng hạt mịn (Fine-grained), dùng để bảo vệ các API endpoint ở backend và ẩn/hiện nút chức năng ở frontend.

---

## 2. Danh mục mã quyền hệ thống (Permission Catalog)

Dưới đây là danh sách các quyền hạn được khai báo trong hệ thống, chia theo nhóm tài nguyên:

### 2.1 Quản lý Đơn thuê (`orders`)
- **`orders.read`**: Xem danh sách đơn thuê, lịch khả dụng, tra cứu trạng thái đơn.
- **`orders.create`**: Tạo đơn thuê mới (dưới dạng DRAFT).
- **`orders.update`**: Chỉnh sửa thông tin đơn thuê nháp, gán thiết bị vật lý cụ thể vào dòng đơn.
- **`orders.update_status`**: Thay đổi trạng thái vận hành đơn (xác nhận đơn, chuyển sang chuẩn bị, bàn giao, nhận trả máy).
- **`orders.cancel`**: Hủy đơn thuê hoặc xóa mềm đơn nháp.
- **`orders.record_payment`**: Ghi nhận các khoản thu tiền cọc, tiền thuê, phụ phí phát sinh thủ công.
- **`orders.refund`**: Ghi nhận hoàn tiền cọc cho khách.

### 2.2 Quản lý Khách hàng (`customers`)
- **`customers.read`**: Xem danh sách và chi tiết thông tin khách hàng.
- **`customers.create`**: Tạo hồ sơ khách hàng mới.
- **`customers.update`**: Cập nhật hồ sơ khách hàng, thay đổi trạng thái (chuyển sang Blacklist).
- **`customers.delete`**: Xóa mềm hồ sơ khách hàng.

### 2.3 Quản lý Danh mục & Sản phẩm (`products`)
- **`products.read`**: Xem danh sách sản phẩm, danh mục, thương hiệu và biểu giá.
- **`products.create`**: Tạo sản phẩm, danh mục, thương hiệu mới.
- **`products.update`**: Sửa đổi sản phẩm, cấu hình bảng giá bậc thang.
- **`products.delete`**: Xóa mềm sản phẩm khỏi danh mục hoạt động.

### 2.4 Quản lý Thiết bị vật lý (`assets`)
- **`assets.read`**: Xem danh sách thiết bị vật lý theo số Serial.
- **`assets.create`**: Thêm mới thiết bị vật lý vào kho.
- **`assets.update`**: Cập nhật trạng thái máy (Bảo trì/Sẵn sàng), báo hỏng thiết bị.
- **`assets.delete`**: Xóa hoặc cho ngừng hoạt động (Retire) một thiết bị vật lý.

### 2.5 Quản lý Người dùng & Vai trò (`users` & `roles`)
- **`users.read`**: Xem danh sách nhân sự nội bộ.
- **`users.create`**: Tạo tài khoản nhân viên mới.
- **`users.update`**: Chỉnh sửa tài khoản nhân viên, khóa tài khoản hoặc reset mật khẩu.
- **`users.delete`**: Xóa tài khoản nhân viên.
- **`roles.read` / `roles.create` / `roles.update` / `roles.delete`**: Xem, tạo, sửa và xóa các vai trò tùy biến.

### 2.6 Báo cáo & Cấu hình (`reports` & `settings`)
- **`reports.read`**: Xem dashboard tổng quan và export báo cáo doanh thu, công nợ.
- **`settings.read`**: Xem cấu hình chính sách thuê (`RentalPolicy`), giờ mở cửa cửa hàng.
- **`settings.update`**: Sửa cấu hình chính sách thuê, đóng cửa hàng, chặn ngày nghỉ lễ.

---

## 3. Thiết lập mặc định của các Vai trò hệ thống

Khi khởi chạy cơ sở dữ liệu lần đầu (qua file seed dữ liệu), hệ thống tự động tạo 4 vai trò hệ thống (`isSystem = true`) với bảng phân bổ quyền mặc định như sau:

| Mã quyền | ADMIN | MANAGER | STAFF | VIEWER |
|---|:---:|:---:|:---:|:---:|
| **Quản lý Đơn thuê (`orders.*`)** | | | | |
| `orders.read` | ✅ | ✅ | ✅ | ✅ |
| `orders.create` | ✅ | ✅ | ✅ | ❌ |
| `orders.update` | ✅ | ✅ | ✅ | ❌ |
| `orders.update_status` | ✅ | ✅ | ✅ | ❌ |
| `orders.cancel` | ✅ | ✅ | ❌ | ❌ |
| `orders.record_payment` | ✅ | ✅ | ✅ | ❌ |
| `orders.refund` | ✅ | ✅ | ❌ | ❌ |
| **Quản lý Khách hàng (`customers.*`)** | | | | |
| `customers.read` | ✅ | ✅ | ✅ | ✅ |
| `customers.create` | ✅ | ✅ | ✅ | ❌ |
| `customers.update` | ✅ | ✅ | ✅ | ❌ |
| `customers.delete` | ✅ | ✅ | ❌ | ❌ |
| **Quản lý Sản phẩm & Thiết bị (`products.*`, `assets.*`)** | | | | |
| `products.read` / `assets.read` | ✅ | ✅ | ✅ | ✅ |
| `products.create` / `assets.create` | ✅ | ✅ | ❌ | ❌ |
| `products.update` / `assets.update` | ✅ | ✅ | ✅ | ❌ |
| `products.delete` / `assets.delete` | ✅ | ✅ | ❌ | ❌ |
| **Người dùng & Phân quyền (`users.*`, `roles.*`)** | | | | |
| `users.read` / `roles.read` | ✅ | ✅ | ❌ | ❌ |
| Các quyền Write còn lại | ✅ | ❌ | ❌ | ❌ |
| **Báo cáo & Cấu hình (`reports.*`, `settings.*`)** | | | | |
| `reports.read` | ✅ | ✅ | ❌ | ❌ |
| `settings.read` | ✅ | ✅ | ✅ | ✅ |
| `settings.update` | ✅ | ✅ | ❌ | ❌ |
