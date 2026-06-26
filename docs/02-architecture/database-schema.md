# Mô hình Cơ sở dữ liệu (Database Schema)

> Tài liệu mô tả chi tiết cấu trúc các bảng dữ liệu trong PostgreSQL, được tạo sinh thông qua Prisma ORM (`prisma/schema.prisma`).

---

## 1. Bản đồ thực thể dữ liệu (ERD Summary)

Hệ thống quản lý cho thuê Rental Admin bao gồm các nhóm thực thể chính:

- **Nhân sự & Phân quyền**: `User`, `Role`, `Permission`, `UserRole`, `RolePermission`.
- **Khách hàng**: `Customer`.
- **Danh mục thiết bị**: `Product`, `ProductCategory`, `Brand`, `ProductRentalPriceTier`, `AssetUnit`.
- **Chính sách & Lịch chặn**: `RentalPolicy`, `StoreBusinessHour`, `StoreClosure`.
- **Đơn thuê & Vận hành**: `RentalOrder`, `RentalOrderItem`, `OrderStatusHistory`, `OrderHandover`, `ReturnInspection`, `DamageReport`, `OrderEvent`.

---

## 2. Mô tả chi tiết các bảng dữ liệu

### 2.1 Bảng Nhân sự & Phân quyền

#### User (Tài khoản nhân viên)
- **`id`**: UUIDv7 (Khóa chính).
- **`email`**: Chuỗi ký tự, duy nhất, dùng đăng nhập.
- **`passwordHash`**: Chuỗi băm mật khẩu.
- **`fullName`**: Tên hiển thị của nhân viên.
- **`activityStatus`**: Trạng thái tài khoản (`ACTIVE`, `BANNED`, `LOCKED`, `INACTIVE`).
- **`searchText`**: Dùng cho tính năng tìm kiếm nhân viên không dấu (Accent-insensitive).

#### Role & Permission (Vai trò và Quyền hạn)
- **`Role`**: Chứa code (ví dụ: `ADMIN`, `MANAGER`, `STAFF`, `VIEWER`) và cờ `isSystem` (không cho phép xóa nếu là vai trò hệ thống).
- **`Permission`**: Chứa mã quyền (ví dụ: `orders.create`, `assets.update`).
- **`UserRole`** và **`RolePermission`**: Bảng trung gian giải quyết quan hệ nhiều-nhiều (n-n).

### 2.2 Bảng Danh mục Sản phẩm & Kho hàng

#### Product (Dòng sản phẩm)
Mẫu mô tả thiết bị cho thuê. Không lưu trữ tồn kho cứng.
- **`sku`**: Mã sản phẩm duy nhất.
- **`dailyPrice`**: Giá thuê mỗi ngày.
- **`depositAmount`**: Mức tiền cọc tiêu chuẩn.
- **`replacementValue`**: Giá trị đền bù nếu làm mất máy.

#### ProductRentalPriceTier (Biểu giá bậc thang)
Cho phép cấu hình giá thuê rẻ hơn nếu khách thuê dài ngày.
- **`minDays`**: Số ngày thuê tối thiểu.
- **`maxDays`**: Số ngày thuê tối đa (null nghĩa là không giới hạn).
- **`dailyPrice`**: Giá thuê ưu đãi áp dụng cho bậc này.

#### AssetUnit (Thiết bị vật lý cụ thể)
Đại diện cho thiết bị thực tế trong kho.
- **`serialNumber`**: Số Serial duy nhất của máy.
- **`status`**: Trạng thái hiện tại (`AVAILABLE`, `RENTED`, `MAINTENANCE`, `DAMAGED`).
- **`condition`**: Tình trạng vật lý (`GOOD`, `SCRATCHED`, `BROKEN`).

### 2.3 Bảng Đơn thuê & Chi tiết giao dịch

#### RentalOrder (Đơn thuê)
Ghi nhận toàn bộ thông tin tài chính và trạng thái đơn.
- **`code`**: Mã đơn hiển thị (ví dụ: `ORD-000001`), có đánh chỉ mục duy nhất.
- **`status`**: Trạng thái đơn (`DRAFT`, `CONFIRMED`, `PREPARING`, `READY_FOR_PICKUP`, `DELIVERING`, `RENTING`, `RETURNED`, `COMPLETED`, `CANCELLED`, `OVERDUE`).
- **`paymentStatus`**: Trạng thái thanh toán (`UNPAID`, `PARTIALLY_PAID`, `PAID`, `REFUNDED`).
- **`startDate` & `endDate`**: Thời gian thuê dự kiến.
- **`blockedEndDate`**: Bằng `endDate` + `turnaroundMinutes` của chính sách, dùng để khóa lịch trống của thiết bị.
- **Snapshots**: Lưu trữ snapshot thông tin khách hàng tại thời điểm tạo đơn (`customerNameSnapshot`, `customerPhoneSnapshot`, ...) để bảo toàn lịch sử.
- **Totals**: Các trường tài chính lưu dạng `Decimal(12, 2)` như `subtotal`, `depositTotal`, `upfrontTotal`, `paidTotal`, `remainingTotal`, `refundTotal`.

#### RentalOrderItem (Dòng sản phẩm trong đơn)
Lưu trữ thông tin chi tiết từng máy thuê.
- **`assetUnitId`**: Thiết bị vật lý cụ thể được gán cho đơn.
- **Snapshots**: Lưu tên sản phẩm, SKU, đơn giá thuê (`unitPrice`), tiền cọc (`depositAmount`) tại thời điểm tạo đơn.

### 2.4 Bảng Nhật ký & Biên bản vận hành

- **`PaymentRecord`**: Ghi nhận lịch sử thu tiền/hoàn tiền thủ công. Chứa `kind` (ví dụ: `DEPOSIT`, `RENTAL_FEE`, `REFUND`), `method` (ví dụ: `CASH`, `BANK_TRANSFER`), và `amount`.
- **`OrderStatusHistory`**: Ghi lại lịch sử chuyển đổi trạng thái của đơn thuê (Audit log).
- **`OrderHandover`**: Biên bản bàn giao máy khi khách nhận và nhận trả máy khi khách trả.
- **`ReturnInspection`**: Biên bản kiểm tra tình trạng máy khi nhận trả, dùng để tính phí phạt trễ hạn (`lateFee`), phí hư hỏng (`damageFee`) hoặc mất phụ kiện (`missingFee`).
- **`DamageReport`**: Chi tiết hư hỏng đính kèm biên bản kiểm tra, ghi rõ mức phạt (`estimatedFee`) và trạng thái xử lý xong hay chưa (`resolved`).

---

## 3. Chiến lược Đánh chỉ mục (Indexing) và Tìm kiếm

Hệ thống sử dụng PostgreSQL và Prisma với các thiết lập tối ưu hóa hiệu năng sau:

### 3.1 Chỉ mục Soft Delete
Hệ thống sử dụng cơ chế xóa mềm (Soft Delete) thông qua cột `deletedAt`. Tất cả các bảng chính đều được cấu hình index cho trường này để tăng tốc độ lọc dữ liệu active:
```prisma
@@index([deletedAt])
```

### 3.2 Tìm kiếm không dấu (Accent-Insensitive Search)
Để tìm kiếm nhanh và chính xác tiếng Việt không dấu (ví dụ khách hàng nhập "Nhat" vẫn ra "Nhật"), hệ thống không gọi hàm SQL lowercase hay xử lý regex trực tiếp khi query vì sẽ làm chậm database.
- **Giải pháp**: Mỗi bảng cần tìm kiếm (`User`, `Customer`, `Product`, `AssetUnit`, `RentalOrder`) đều có cột `searchText` lưu trữ chuỗi đã được chuẩn hóa (loại bỏ dấu tiếng Việt, viết thường, ghép các trường tìm kiếm lại với nhau).
- **Chỉ mục GIN**: Sử dụng extension `pg_trgm` của PostgreSQL để tạo index trigram GIN trên trường `searchText`:
```prisma
@@index([searchText(ops: raw("gin_trgm_ops"))], type: Gin, map: "User_searchText_trgm_idx")
```
- Việc này giúp các câu lệnh tìm kiếm tương đối (chứa từ khóa) chạy cực kỳ nhanh ngay cả khi tập dữ liệu lớn.
