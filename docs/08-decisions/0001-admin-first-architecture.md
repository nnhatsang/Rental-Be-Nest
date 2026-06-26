# ADR 0001: Kiến trúc thiết kế ưu tiên Admin (Admin-First Architecture)

- **Trạng thái**: Đã duyệt (Approved)
- **Người đề xuất**: Tech Lead / Product Owner
- **Ngày quyết định**: 2026-06-06
- **Bối cảnh**: Tái định hướng từ dự án CMS tự phục vụ sang hệ thống quản lý chuyên biệt cho thuê thiết bị quay chụp.

---

## 1. Bối cảnh bài toán (Context)

Hệ thống cho thuê thiết bị quay chụp (máy ảnh, ống kính, thiết bị ánh sáng) có tính chất đặc thù về rủi ro tài sản và vận hành:
- Thiết bị có giá trị cao (từ vài triệu đến hàng trăm triệu đồng mỗi đơn vị).
- Cần kiểm tra ngoại quan vật lý, phụ kiện đi kèm, thời lượng pin cả hai chiều (khi giao máy cho khách và khi khách trả máy).
- Lịch trình đặt thuê liên tục, nguy cơ quá hạn hoặc hỏng máy ảnh hưởng trực tiếp đến các đơn tiếp theo của máy đó.

Phát triển một hệ thống tự phục vụ cho khách hàng (Customer Self-Service) với thanh toán tự động ngay ở giai đoạn đầu (Phase 1) có nhiều rủi ro:
1. Trùng lịch ảo do khách tự đặt nhưng không thanh toán hoặc bùng lịch.
2. Không kiểm soát được tình trạng thiết bị thực tế trước khi khách nhận.
3. Chi phí tích hợp cổng thanh toán online phức tạp và chưa cấp thiết khi hầu hết khách hàng thuê máy ảnh thích thanh toán chuyển khoản thủ công hoặc đặt cọc giữ chỗ.

---

## 2. Quyết định (Decision)

Chúng tôi quyết định thiết kế kiến trúc hệ thống theo hướng **Admin-First** cho Phase 1:

1. **Vận hành nội bộ**: Đơn thuê sẽ do nhân viên cửa hàng tạo hộ khách hàng trực tiếp trên hệ thống Admin Console. Nhân viên có toàn quyền kiểm soát tính hợp lệ của khách hàng (CCCD, nợ xấu) trước khi bấm xác nhận đơn.
2. **Ghi nhận thanh toán thủ công**: Mọi giao dịch tiền đặt cọc giữ máy, tiền thuê trước, và hoàn cọc khi nhận trả máy đều được nhân viên xác nhận thực tế và bấm nút ghi nhận thủ công (`PaymentRecord`) trên phần mềm. Không tích hợp API callback của MoMo hay VNPay.
3. **Quản lý thiết bị hạt mịn**: Gán trực tiếp từng chiếc máy cụ thể (theo số Serial) vào đơn hàng để quản lý bận/rảnh theo thời gian (Overlap checking) và theo dõi tình trạng hư hỏng qua biên bản kiểm tra vật lý (`ReturnInspection`).

---

## 3. Hệ quả (Consequences)

### 3.1 Ưu điểm (Positive)
- **Tốc độ đưa ra thị trường nhanh**: Rút ngắn thời gian phát triển do lược bỏ các module phức tạp (giỏ hàng, thanh toán tự động, đăng ký khách hàng diện rộng).
- **Vận hành an toàn**: Nhân viên trực tiếp kiểm soát việc gán máy vật lý, giảm tối đa tỷ lệ trùng lịch hoặc giao nhầm máy hỏng.
- **Dữ liệu chuẩn hóa**: Tạo tiền đề vững chắc cho cơ sở dữ liệu (schema) chuẩn chỉ để khi nâng cấp lên Phase 2 (cho khách tự đặt qua website) chỉ cần mở thêm API endpoint mà không phải sửa đổi cấu trúc bảng cốt lõi.

### 3.2 Nhược điểm (Negative)
- **Phụ thuộc vào nhân sự**: Mọi đơn thuê đều phải có nhân viên tạo hộ, không tự động hóa hoàn toàn 100%.
- **Nhập liệu thủ công**: Có thể xảy ra sai sót nhập liệu (ví dụ: gõ sai số tiền chuyển khoản). Cần có cơ chế log lịch sử trạng thái (`OrderStatusHistory`) và log sự kiện (`OrderEvent`) để quản lý đối soát hậu kỳ.
