# Tổng quan dự án Rental Admin

> Tài liệu mô tả tầm nhìn sản phẩm, các vai trò của người dùng trong hệ thống và danh sách màn hình chức năng của Rental Admin.

---

## 1. Bài toán & Mục tiêu sản phẩm

Rental Admin là hệ thống quản lý cho thuê thiết bị quay phim, chụp ảnh (máy ảnh, lens, gimbal, đèn, micro...). Khác với các hệ thống thương mại điện tử thông thường, sản phẩm này được thiết kế theo hướng **Admin-First (Phần mềm quản trị vận hành nội bộ)**.

### Mục tiêu chính của Phase 1
- Hỗ trợ nhân viên và admin thao tác trực tiếp tại quầy hoặc qua kênh hỗ trợ (Zalo/điện thoại) để tạo đơn thuê hộ khách hàng.
- Theo dõi vòng đời của thiết bị vật lý cụ thể (quản lý theo số Serial của từng máy ảnh, ống kính).
- Kiểm tra tính khả dụng của sản phẩm dựa trên lịch thời gian thuê chồng chéo, tránh hiện tượng trùng lịch (Overbooking).
- Ghi nhận thủ công tiền cọc, tiền thuê, các khoản phụ phí (trễ hạn, hư hỏng) và hoàn cọc cho khách.
- Phân quyền nghiêm ngặt cho nhân viên bằng cơ chế RBAC (Role-Based Access Control).

> [!IMPORTANT]
> **Giới hạn phạm vi Phase 1:** Không xây dựng giỏ hàng (Cart), không có cổng thanh toán online tự động (MoMo, VNPay callback), không có màn hình khách hàng tự đặt hàng trực tuyến (Customer self-service). Tất cả giao dịch tiền tệ đều được admin ghi nhận thủ công sau khi xác thực thực tế.

---

## 2. Các vai trò sử dụng hệ thống (User Roles)

Hệ thống phân chia quyền hạn dựa trên 4 nhóm chính:

### 2.1 Admin (Quản trị viên tối cao)
- Quản lý tài khoản nhân viên, thiết lập vai trò và phân quyền (RBAC).
- Có toàn quyền CRUD tất cả dữ liệu (sản phẩm, thiết bị, đơn thuê, khách hàng, cấu hình hệ thống).
- Được phép sửa đổi thông tin nhạy cảm hoặc ghi đè trạng thái của đơn thuê trong trường hợp có tranh chấp nghiệp vụ.

### 2.2 Manager (Quản lý vận hành)
- Xem báo cáo doanh thu, công nợ, hiệu suất thuê của thiết bị.
- Duyệt đơn hàng, cập nhật, hủy đơn hoặc xác nhận hoàn trả cọc lớn.
- Phân bổ nhân viên phụ trách chuẩn bị và bàn giao máy.
- Theo dõi thiết bị hỏng cần bảo trì.

### 2.3 Staff (Nhân viên vận hành)
- Tạo mới hồ sơ khách hàng.
- Tạo đơn thuê nháp, kiểm tra lịch trống và gán thiết bị vật lý cụ thể vào đơn.
- Làm thủ tục bàn giao máy (Checklist trạng thái tốt/xước/thiếu phụ kiện).
- Nhận trả máy từ khách, ghi nhận thời gian thực tế và tạo biên bản kiểm tra tình trạng máy.
- Ghi nhận thanh toán thủ công (thu tiền mặt hoặc chụp ảnh màn hình chuyển khoản).

### 2.4 Viewer (Nhân viên xem dữ liệu)
- Chỉ có quyền xem thông tin (sản phẩm, thiết bị, đơn thuê, khách hàng, báo cáo).
- Không được thực hiện bất kỳ hành động thêm, sửa, xóa hoặc thay đổi trạng thái nào.

---

## 3. Điều hướng tổng thể (Sitemap Admin)

Dưới đây là các cụm màn hình chính trên Sidebar Admin phục vụ quy trình vận hành:

| Nhóm chức năng | Tên trang / Route | Mục đích vận hành |
|---|---|---|
| **Xác thực** | Đăng nhập (`/auth/login`) | Nhân viên/admin đăng nhập vào hệ thống |
| | Hồ sơ cá nhân (`/profile`) | Xem thông tin tài khoản và phân quyền hiện tại |
| **Vận hành trong ngày** | Dashboard (`/dashboard`) | Tổng hợp số liệu vận hành nhanh trong ngày |
| | Lịch thuê (`/rental-calendar`) | Giao diện lịch biểu xem thiết bị nào đang bận |
| | Việc cần làm (`/tasks/today`) | Danh sách đơn cần chuẩn bị, bàn giao, hoặc nhận trả hôm nay |
| **Quản lý đơn thuê** | Danh sách đơn (`/rental-orders`) | Tìm kiếm, lọc và xem chi tiết các đơn thuê |
| | Tạo đơn mới (`/rental-orders/new`) | Tạo đơn thủ công theo từng bước (chọn khách, ngày thuê, thiết bị, tính tiền) |
| | Bàn giao máy (`/rental-orders/:id/handover`) | Checklist bàn giao phụ kiện & tình trạng khi giao máy |
| | Nhận trả máy (`/rental-orders/:id/return`) | Checklist kiểm tra khi khách trả máy (tính phí trễ, phí hư hỏng nếu có) |
| **Kiểm tra khả dụng** | Tra cứu lịch trống (`/availability`) | Kiểm tra nhanh thiết bị nào còn trống trong khoảng thời gian khách hỏi |
| **Khách hàng** | Quản lý khách (`/customers`) | Quản lý thông tin liên hệ, CCCD, lịch sử thuê và công nợ của khách |
| **Danh mục sản phẩm** | Sản phẩm (`/products`) | Định nghĩa các dòng máy (ví dụ: Sony A7 IV, Lens 24-70 GM) và bảng giá thuê |
| **Thiết bị vật lý** | Thiết bị con (`/asset-units`) | Quản lý chi tiết từng máy vật lý theo số Serial, trạng thái hiện tại (Sẵn sàng/Hỏng/Bảo trì) |
| **Thanh toán** | Giao dịch (`/payments`) | Lưu nhật ký thu tiền cọc, tiền thuê, hoàn tiền cho khách |
| **Báo cáo** | Doanh thu & Vận hành (`/reports`) | Thống kê dòng tiền thu/chi và hiệu suất khai thác thiết bị |
| **Phân quyền** | Người dùng & Vai trò (`/users`, `/roles`) | Quản lý nhân sự và gán quyền RBAC |
