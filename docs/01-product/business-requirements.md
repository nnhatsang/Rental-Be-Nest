# Yêu cầu nghiệp vụ sản phẩm (Business Requirements)

> Tài liệu mô tả phạm vi chức năng Phase 1 (Admin-first) và các yêu cầu nghiệp vụ chi tiết cho từng nhóm mô-đun của hệ thống Rental Admin.

---

## 1. Định hướng phạm vi Phase 1 (Admin-First)

Mục tiêu chính là tối ưu hóa quy trình nghiệp vụ cho đội ngũ nhân sự nội bộ (nhân viên tại cửa hàng, người quản lý, quản trị viên hệ thống). Hệ thống hoạt động theo mô hình offline-to-online, trong đó nhân viên là người trung gian nhập liệu và kiểm soát toàn bộ vòng đời đơn thuê.

### 🚫 Các tính năng CHƯA XÂY DỰNG ở Phase 1:
- **Giỏ hàng (Cart)** và luồng thanh toán tự động (Momo, VNPay API Callback).
- **Trang đặt hàng tự phục vụ** dành cho khách hàng vãng lai (Customer checkout flow).
- **Cơ chế thu hồi mã giữ máy tự động** khi quá hạn thanh toán đặt lịch (Auto-expiring orders).

---

## 2. Chi tiết yêu cầu nghiệp vụ theo Mô-đun

### 2.1 Quản trị tài khoản nội bộ (Auth, Users, RBAC)
- **Đăng nhập**: Sử dụng Email và Mật khẩu. Trả về Token JWT và lưu trong cookie HttpOnly bảo mật.
- **Trạng thái tài khoản**: Tài khoản nhân viên có 4 trạng thái: `ACTIVE` (đang hoạt động), `BANNED` (bị cấm), `LOCKED` (khóa tạm thời do nhập sai mật khẩu nhiều lần), `INACTIVE` (chưa kích hoạt).
- **Phân quyền nâng cao (RBAC)**: Không phân quyền trực tiếp qua role dạng chuỗi đơn giản. Phân quyền thông qua các bảng liên kết `User` ↔ `Role` ↔ `Permission`.
  - Một nhân viên có thể được gán nhiều vai trò (`UserRole`).
  - Một vai trò được cấp một danh sách quyền cụ thể (`RolePermission`).
  - Hệ thống kiểm tra quyền của route dựa trên mã quyền ổn định (ví dụ: `orders.create`, `products.update`).

### 2.2 Quản lý Khách hàng (Customers)
- **Thông tin cơ bản**: Tên, Số điện thoại, Email, Địa chỉ, Số CCCD/Hộ chiếu (Identity Number), link mạng xã hội (Facebook/Zalo để liên hệ khi cần).
- **Tình trạng khách**: Khách hàng có thể bị chuyển sang trạng thái `BLACKLISTED` nếu có lịch sử bùng máy, làm hỏng thiết bị không đền bù hoặc trả quá hạn nghiêm trọng.
- **Tìm kiếm**: Hỗ trợ tìm kiếm không dấu (Accent-insensitive) theo Tên, Số điện thoại và Email để nhân viên tìm nhanh khi khách gọi điện.

### 2.3 Quản lý Thiết bị (Products & AssetUnits)
Hệ thống quản lý thiết bị theo mô hình hai cấp:
- **Product (Dòng sản phẩm)**: Khai báo mẫu máy (Ví dụ: Sony A7 IV). Khai báo các thông tin về giá thuê theo ngày, giá thuê theo giờ phụ trội, giá trị đền bù thay thế nếu mất máy (`replacementValue`).
- **AssetUnit (Thiết bị vật lý cụ thể)**: Khai báo từng chiếc máy ảnh/ống kính trong kho ứng với dòng sản phẩm đó, đi kèm số Serial cụ thể.
- **Trạng thái thiết bị (`AssetStatus`)**:
  - `AVAILABLE`: Sẵn sàng cho thuê.
  - `RENTED`: Đang cho khách thuê.
  - `MAINTENANCE`: Đang bảo trì/vệ sinh.
  - `DAMAGED`: Đang hỏng (chờ sửa hoặc thanh lý).
- **Tình trạng thiết bị (`AssetCondition`)**: `GOOD` (Tốt), `SCRATCHED` (Xước nhẹ), `BROKEN` (Hỏng/Vỡ).

### 2.4 Quản lý Đơn thuê (Rental Orders)
Quy trình xử lý đơn thuê trải qua các trạng thái bắt buộc:
1. **DRAFT (Nháp)**: Đơn hàng mới tạo, nhân viên đang thêm thiết bị và thông tin khách hàng. Chưa chặn lịch trống của máy.
2. **CONFIRMED (Đã xác nhận)**: Khách hàng đã chuyển khoản cọc giữ máy (Booking hold fee) hoặc admin xác nhận giữ máy. Hệ thống chính thức chặn lịch của thiết bị vật lý đã gán.
3. **PREPARING (Đang chuẩn bị)**: Nhân viên trong kho lấy máy, sạc pin, kiểm tra phụ kiện đi kèm.
4. **READY_FOR_PICKUP / DELIVERING (Sẵn sàng giao)**: Máy đã chuẩn bị xong, chờ khách đến lấy hoặc shipper đang giao máy.
5. **RENTING (Đang thuê)**: Khách đã nhận máy.
6. **RETURNED (Đã trả máy)**: Khách mang trả máy. Nhân viên kỹ thuật tiến hành kiểm tra máy (`ReturnInspection`).
7. **COMPLETED (Hoàn tất)**: Đã tính toán xong các phụ phí phát sinh (nếu có), hoàn cọc cho khách và thanh lý hợp đồng.

### 2.5 Kiểm tra trùng lịch (Availability Check)
- Khi nhân viên tạo đơn hoặc kiểm tra nhanh lịch trống, hệ thống bắt buộc phải quét các đơn hàng có khoảng thời gian thuê chồng chéo (Overlap) để đảm bảo không gán trùng một chiếc máy ảnh cho hai khách hàng khác nhau trong cùng một thời điểm.
- Công thức kiểm tra khoảng thời gian thuê chồng chéo giữa đơn mới và đơn hiện hữu:
  `Tập đơn trùng = đơn_hiện_tại.startDate < đơn_mới.endDate AND đơn_hiện_tại.endDate > đơn_mới.startDate`
- Đồng thời áp dụng thời gian đệm (`turnaroundMinutes`) cấu hình trong `RentalPolicy` để nhân viên kịp vệ sinh, sạc pin trước khi giao máy cho lượt thuê tiếp theo.
