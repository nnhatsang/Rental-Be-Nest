# Quản lý Rủi ro & Yêu cầu Phi chức năng (Risks & NFR)

> Tài liệu nhận diện các rủi ro vận hành nghiệp vụ của hệ thống Rental Admin và định nghĩa các tiêu chuẩn kỹ thuật phi chức năng (Non-Functional Requirements).

---

## 1. Quản lý Rủi ro Nghiệp vụ (Business Risks)

Do đặc thù hệ thống quản lý cho thuê thiết bị quay chụp có giá trị cao, các rủi ro vận hành cần được kiểm soát chặt chẽ ở cả mức nghiệp vụ và thiết kế phần mềm:

### 1.1 Rủi ro Trùng lịch máy (Overbooking)
- **Mô tả**: Hai nhân viên gán cùng một chiếc máy ảnh vật lý (`AssetUnit`) có cùng số Serial cho hai khách hàng khác nhau trong các khoảng thời gian bị chồng chéo.
- **Biện pháp giảm thiểu**:
  - Tích hợp kiểm tra trùng lịch cưỡng bức (Time Overlap Validation) trong cơ chế transaction của database ở Backend trước khi chuyển trạng thái đơn sang `CONFIRMED`.
  - Áp dụng thời gian đệm (`turnaroundMinutes`) cấu hình động để dự phòng thời gian vệ sinh, sạc pin.

### 1.2 Rủi ro Thất thoát Tài sản (Asset Loss)
- **Mô tả**: Khách hàng thuê máy ảnh giá trị lớn nhưng đặt cọc thấp, sau đó không mang trả máy hoặc làm hỏng nghiêm trọng nhưng từ chối đền bù.
- **Biện pháp giảm thiểu**:
  - Hỗ trợ trường thông tin chụp ảnh/lưu số CCCD/Hộ chiếu trong hồ sơ khách hàng.
  - Phân loại trạng thái khách hàng (`CustomerStatus`) với nhãn `BLACKLISTED` để hệ thống tự động ngăn chặn tạo đơn thuê mới.
  - Snapshot giá trị đền bù (`replacementValue`) vào đơn thuê làm căn cứ pháp lý khi ký hợp đồng.

### 1.3 Rủi ro Sai lệch Đối soát Tài chính (Manual Transaction Mistakes)
- **Mô tả**: Nhân viên nhập sai số tiền cọc hoặc tiền thuê thực tế thu từ khách (gõ thiếu số 0, chọn sai hình thức chuyển khoản).
- **Biện pháp giảm thiểu**:
  - Bắt buộc ghi nhận mã giao dịch ngân hàng (`referenceCode`) đối với hình thức `BANK_TRANSFER`.
  - Không cho phép sửa đổi tùy tiện các bản ghi `PaymentRecord` đã ở trạng thái `SUCCESS`. Khi cần điều chỉnh, phải tạo bản ghi điều chỉnh (`ADJUSTMENT`) đi kèm ghi chú lý do để dễ đối soát sau này.

---

## 2. Yêu cầu Phi chức năng (Non-Functional Requirements)

### 2.1 Bảo mật & An toàn thông tin (Security)
- **Xác thực Cookie**: Sử dụng token JWT lưu trong cookie trình duyệt với các cờ bảo vệ tối đa: `HttpOnly` (chống mã độc Javascript đọc token), `Secure` (chỉ truyền qua HTTPS), và `SameSite=Lax` (chống tấn công CSRF).
- **Phân quyền hạt mịn**: Mọi request API sửa đổi dữ liệu bắt buộc phải được lọc qua `PermissionGuard` để đối chiếu mã quyền nghiệp vụ, không dựa vào định danh User thô.

### 2.2 Hiệu năng & Tốc độ phản hồi (Performance)
- **Tốc độ tìm kiếm**: Câu lệnh truy vấn tìm kiếm khách hàng, đơn thuê, thiết bị (Accent-insensitive search) phải phản hồi dưới **200ms** khi tập dữ liệu đạt quy mô 100,000 bản ghi.
  - *Giải pháp kỹ thuật*: Sử dụng chỉ mục GIN Trigram index trên cột chuẩn hóa `searchText`.
- **Tải trang**: Trang danh sách admin phải hỗ trợ phân trang (Pagination) mặc định từ database, tránh tải toàn bộ tập dữ liệu lên client.

### 2.3 Nhật ký kiểm toán (Audit Logging)
- Mọi hành động chuyển đổi trạng thái của đơn thuê bắt buộc phải ghi nhận vào bảng `OrderStatusHistory` bao gồm: người thực hiện (`createdBy`), trạng thái cũ, trạng thái mới, lý do chuyển đổi và thời gian thực tế.
- Mọi hoạt động nghiệp vụ nhạy cảm (ghi nhận thanh toán, hoàn cọc) phải lưu trữ snapshot người tạo để phục vụ mục đích hậu kiểm.
