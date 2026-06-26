# Danh sách Endpoints API (Backend Endpoints)

> Tài liệu tổng hợp danh sách các API Route của Backend NestJS, phân theo mô-đun và mã quyền tương ứng.

---

## 1. Quy ước Route (Route Convention)

- **Global Prefix** được thiết lập trong `src/main.ts` là: `/api`.
- **Admin API Prefix**: Khuyến nghị định tuyến các route quản trị có tiền tố `admin/` trong controller để phân biệt rõ ràng:
  ```typescript
  @Controller('admin/users')
  export class UsersController {}
  ```
  Route thực tế sẽ là: `/api/admin/users`.

---

## 2. Danh sách Endpoint chi tiết

### 2.1 Nhóm Xác thực (Authentication)
- Base Path: `/api/admin/auth`

| Method | Path | Public | Mô tả chức năng |
|---|---|:---:|---|
| `POST` | `/login` | ✅ | Đăng nhập tài khoản, thiết lập cookies Access/Refresh token. |
| `POST` | `/forgot-password` | ✅ | Yêu cầu gửi email khôi phục mật khẩu. |
| `POST` | `/reset-password` | ✅ | Đặt lại mật khẩu mới bằng mã token. |
| `GET` | `/reset-password/verify` | ✅ | Xác thực mã token đặt lại mật khẩu có hợp lệ không. |
| `POST` | `/refresh` | ✅ | Sử dụng Refresh Token trong cookie để lấy Access Token mới. |
| `POST` | `/logout` | ❌ | Đăng xuất, xóa các cookie xác thực khỏi trình duyệt. |
| `GET` | `/me` | ❌ | Lấy thông tin tài khoản hiện tại đang đăng nhập. |
| `PATCH` | `/me` | ❌ | Cập nhật hồ sơ cá nhân. |
| `PATCH` | `/me/password` | ❌ | Đổi mật khẩu tài khoản cá nhân. |

### 2.2 Nhóm Quản lý Nhân sự (Internal Users)
- Base Path: `/api/users`

| Method | Path | Mã quyền yêu cầu | Mô tả chức năng |
|---|---|---|---|
| `GET` | `/` | `users.read` | Lấy danh sách nhân viên nội bộ (hỗ trợ phân trang, bộ lọc). |
| `GET` | `/:id` | `users.read` | Lấy chi tiết tài khoản nhân viên. |
| `POST` | `/` | `users.create` | Tạo tài khoản nhân viên mới (mặc định trạng thái `ACTIVE`). |
| `PATCH` | `/:id` | `users.update` | Cập nhật thông tin cơ bản nhân viên. |
| `PATCH` | `/:id/activity-status` | `users.update` | Khóa/Mở khóa tài khoản nhân viên (`activityStatus`). |
| `PATCH` | `/:id/roles` | `users.update` | Gán hoặc thay đổi vai trò (Roles) của nhân viên. |
| `PATCH` | `/:id/password` | `users.update` | Quản trị viên reset mật khẩu cho nhân viên. |
| `DELETE` | `/:id` | `users.delete` | Xóa mềm tài khoản nhân viên. |

### 2.3 Nhóm Quản lý Khách hàng (Customers)
- Base Path: `/api/customers`

| Method | Path | Mã quyền yêu cầu | Mô tả chức năng |
|---|---|---|---|
| `GET` | `/` | `customers.read` | Danh sách khách hàng (tìm kiếm theo `searchText`). |
| `GET` | `/:id` | `customers.read` | Xem thông tin chi tiết, lịch sử thuê, công nợ. |
| `POST` | `/` | `customers.create` | Tạo mới hồ sơ khách hàng. |
| `PATCH` | `/:id` | `customers.update` | Cập nhật thông tin khách hàng. |
| `PATCH` | `/:id/status` | `customers.update` | Cập nhật trạng thái khách hàng (ví dụ: Blacklist). |
| `DELETE` | `/:id` | `customers.delete` | Xóa mềm hồ sơ khách hàng. |

### 2.4 Nhóm Quản lý Danh mục & Sản phẩm (Products)
- Base Path: `/api/products`

| Method | Path | Mã quyền yêu cầu | Mô tả chức năng |
|---|---|---|---|
| `GET` | `/` | `products.read` | Danh sách sản phẩm khả dụng. |
| `GET` | `/:id` | `products.read` | Chi tiết sản phẩm kèm biểu giá bậc thang. |
| `POST` | `/` | `products.create` | Thêm mới dòng sản phẩm. |
| `PATCH` | `/:id` | `products.update` | Cập nhật thông tin sản phẩm và biểu giá bậc thang. |
| `PATCH` | `/:id/status` | `products.update` | Bật/tắt trạng thái hoạt động của sản phẩm. |
| `DELETE` | `/:id` | `products.delete` | Xóa mềm sản phẩm. |

### 2.5 Nhóm Thiết bị vật lý (Asset Units)
- Base Path: `/api/asset-units`

| Method | Path | Mã quyền yêu cầu | Mô tả chức năng |
|---|---|---|---|
| `GET` | `/` | `assets.read` | Danh sách thiết bị vật lý có serial. |
| `GET` | `/:id` | `assets.read` | Chi tiết thiết bị vật lý, lịch sử đơn thuê đi kèm. |
| `POST` | `/` | `assets.create` | Thêm thiết bị vật lý vào kho. |
| `PATCH` | `/:id` | `assets.update` | Sửa thông tin serial, ghi chú thiết bị. |
| `PATCH` | `/:id/status` | `assets.update` | Cập nhật tình trạng máy (`AVAILABLE`, `MAINTENANCE`, `DAMAGED`). |
| `DELETE` | `/:id` | `assets.delete` | Cho nghỉ hưu (Retire) hoặc xóa mềm thiết bị. |

### 2.6 Nhóm Vận hành Đơn thuê (Rental Orders)
- Base Path: `/api/rental-orders`

| Method | Path | Mã quyền yêu cầu | Mô tả chức năng |
|---|---|---|---|
| `POST` | `/check-availability` | `orders.read` | Kiểm tra lịch trống của sản phẩm/máy. |
| `GET` | `/` | `orders.read` | Danh sách đơn thuê hệ thống. |
| `GET` | `/:id` | `orders.read` | Chi tiết đơn thuê, thông tin snapshots và các biên bản đính kèm. |
| `POST` | `/` | `orders.create` | Tạo mới đơn thuê nháp (`DRAFT`). |
| `PATCH` | `/:id/items/assign-assets` | `orders.update` | Gán thiết bị vật lý cụ thể (Serial) vào đơn thuê. |
| `POST` | `/:id/confirm` | `orders.update_status` | Xác nhận đơn thuê (`DRAFT` → `CONFIRMED`). |
| `POST` | `/:id/cancel` | `orders.cancel` | Hủy đơn thuê. |
| `PATCH` | `/:id` | `orders.update` | Sửa đổi thông tin đơn nháp. |
| `DELETE` | `/:id` | `orders.cancel` | Xóa mềm đơn thuê nháp. |
