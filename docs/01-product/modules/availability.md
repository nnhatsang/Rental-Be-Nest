# Mô-đun Nghiệp vụ: Kiểm tra khả dụng & Bảng giá (Availability & Pricing Module)

> Tài liệu mô tả yêu cầu sản phẩm cho tính năng kiểm tra lịch trống khả dụng của thiết bị và cơ chế tính toán giá thuê.

---

## 1. Màn hình tra cứu lịch trống (`/availability`)

Màn hình này giúp nhân viên tư vấn nhanh cho khách hàng khi họ hỏi thông tin qua điện thoại hoặc mạng xã hội.

### Yêu cầu chức năng:
- **Bộ lọc thời gian**: Nhân viên nhập khoảng thời gian khách muốn thuê (Thời điểm bắt đầu và Thời điểm trả máy dự kiến).
- **Bộ lọc danh mục**: Chọn nhóm thiết bị cần tra cứu (ví dụ: Camera, Lens).
- **Kết quả hiển thị**: Bảng danh sách sản phẩm kèm theo:
  - Tổng số lượng thiết bị vật lý có trong kho của sản phẩm đó.
  - Số lượng máy bận (đã bị gán trong các đơn thuê khác trùng lịch).
  - Số lượng máy rảnh thực tế khả dụng.
  - Nút "Tạo đơn nhanh" cho sản phẩm đó nếu số lượng rảnh > 0.

---

## 2. Quy tắc gán số Serial vật lý (`AssetUnit Assignment`)

- Khi nhân viên tạo đơn thuê nháp (`DRAFT`), họ có thể gán trước số Serial cụ thể của thiết bị (`assetUnitId`) cho từng dòng sản phẩm hoặc để trống để thủ kho gán sau.
- **Tự động đề xuất**: Khi gán thiết bị vật lý, hệ thống phải tự động liệt kê danh sách các số Serial thuộc dòng sản phẩm đó đang rảnh (không có lịch trùng trong khoảng thuê của đơn).
- **Khóa lịch bận**: Ngay khi đơn chuyển từ `DRAFT` sang `CONFIRMED`, hệ thống chính thức khóa lịch bận của số Serial đã gán. Cấm gán số Serial này cho bất kỳ đơn nào khác trùng lịch.

---

## 3. Quy tắc tính giá thuê theo Biểu giá bậc thang

Hệ thống hỗ trợ cấu hình giá thuê dài ngày linh hoạt cho từng dòng sản phẩm để thu hút khách hàng thuê dài hạn.

### Ví dụ về Biểu giá bậc thang của sản phẩm "Sony A7 IV":
- Giá mặc định: `500,000 VND / ngày`
- Bậc 1 (Thuê từ 3 - 5 ngày): `450,000 VND / ngày`
- Bậc 2 (Thuê từ 6 ngày trở lên): `400,000 VND / ngày`

### Cách thức hoạt động:
- Khi tính tiền đơn thuê, hệ thống tự động đếm số ngày thuê thực tế làm tròn lên (ví dụ: Thuê 3 ngày 2 giờ được tính là 4 ngày).
- So sánh số ngày này với bảng `ProductRentalPriceTier` để lấy đơn giá ngày ưu đãi nhất tương ứng.
- Phí phụ trội giờ trễ (`hourlyOveragePrice`) được tính bằng giờ thực tế trễ nhân với đơn giá giờ quá hạn của sản phẩm (nếu không khai báo đơn giá giờ quá hạn, phí trễ mặc định bằng $10\%$ giá thuê ngày cho mỗi giờ trễ).
