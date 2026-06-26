# Thuật ngữ dự án (Glossary)

> Định nghĩa các khái niệm cốt lõi trong hệ thống quản lý cho thuê Rental Admin nhằm đồng nhất cách hiểu giữa Đội Nghiệp vụ, Lập trình viên Backend (Prisma DB Models), và Lập trình viên Frontend.

---

## 1. Khái niệm cốt lõi về Sản phẩm và Thiết bị

### 1.1 Product (Dòng sản phẩm)
- **Định nghĩa**: Một mẫu model hoặc dòng sản phẩm cho thuê trong danh mục. Nó chứa các thông tin chung như tên, SKU, mô tả, giá thuê ngày, giá thuê giờ quá hạn, và mức tiền đặt cọc tiêu chuẩn.
- **Ví dụ**: *Sony A7 IV*, *Canon EOS R5*, *Lens Sony FE 24-70mm f/2.8 GM II*.
- **Database Model**: `Product` in `schema.prisma`.

### 1.2 AssetUnit (Thiết bị vật lý con / Thiết bị có số Serial)
- **Định nghĩa**: Một thực thể thiết bị vật lý cụ thể trong kho hàng thuộc một dòng sản phẩm (`Product`). Mỗi `AssetUnit` bắt buộc phải có thông tin định danh riêng (thường là số Serial hoặc mã vạch nội bộ) và theo dõi trạng thái vận hành riêng biệt (đang rảnh, đang cho thuê, đang hỏng, hoặc đang bảo trì).
- **Ví dụ**: *Máy ảnh Sony A7 IV có số Serial SN983749*.
- **Mối quan hệ**: Một `Product` có thể có nhiều `AssetUnit` trực thuộc. Hàng tồn kho của dòng sản phẩm được tính động dựa trên số lượng `AssetUnit` ở trạng thái khả dụng, chứ không lưu trữ cứng ở cột `stockQuantity` tại bảng sản phẩm.
- **Database Model**: `AssetUnit` in `schema.prisma`.

---

## 2. Khái niệm cốt lõi về Đơn hàng và Vận hành

### 2.1 RentalOrder (Đơn thuê)
- **Định nghĩa**: Thực thể ghi nhận toàn bộ vòng đời của một giao dịch thuê máy từ khi khách hàng đặt lịch giữ máy (DRAFT/CONFIRMED), chuẩn bị máy (PREPARING), bàn giao cho khách (RENTING), khách trả máy (RETURNED) cho đến lúc tất toán tài chính thành công (COMPLETED).
- **Database Model**: `RentalOrder` in `schema.prisma`.

### 2.2 RentalOrderItem (Dòng thiết bị trong đơn)
- **Định nghĩa**: Các thiết bị được thuê cụ thể trong đơn hàng. Mỗi dòng ghi nhận thông tin dòng sản phẩm (`productId`), thiết bị vật lý được gán (`assetUnitId`), kèm theo ảnh chụp nhanh (Snapshot) về tên sản phẩm, SKU và đơn giá thuê tại thời điểm tạo đơn để giữ lịch sử ổn định (tránh đơn cũ bị thay đổi tổng tiền khi admin đổi giá sản phẩm ở danh mục).
- **Database Model**: `RentalOrderItem` in `schema.prisma`.

### 2.3 RentalPolicy (Chính sách thuê)
- **Định nghĩa**: Bộ cấu hình các quy định cho thuê mặc định áp dụng toàn hệ thống, bao gồm số tiền đặt lịch giữ máy tối thiểu cho mỗi máy (`bookingHoldAmountPerUnit`) và thời gian giãn cách/đệm dọn dẹp giữa hai lượt thuê của cùng một máy (`turnaroundMinutes`).
- **Database Model**: `RentalPolicy` in `schema.prisma`.

---

## 3. Khái niệm cốt lõi về Tài chính trong Đơn thuê

- **Subtotal (Tiền thuê gốc)**: Tổng tiền thuê thực tế của các thiết bị (sau khi áp dụng biểu giá bậc thang theo số ngày thuê).
- **DepositTotal (Tổng tiền cọc)**: Tiền đặt cọc của các máy trong đơn hàng để đảm bảo tài sản (thường khách trả máy xong sẽ được hoàn lại khoản này sau khi trừ các phụ phí nếu có).
- **UpfrontTotal (Tiền cần thu trước)**: Tổng số tiền khách cần thanh toán trước hoặc ngay lúc nhận máy. Công thức: `UpfrontTotal = Subtotal + DepositTotal + DeliveryFee - Discount`.
- **BookingHoldTotal (Tiền giữ máy)**: Số tiền khách đặt trước trực tuyến/chuyển khoản để giữ chỗ thiết bị (lấy từ `bookingHoldAmountPerUnit` của chính sách thuê nhân với số lượng máy).
- **HandoverDueTotal (Tiền thanh toán tại quầy)**: Số tiền còn lại khách cần trả lúc nhận máy sau khi đã trừ tiền giữ chỗ. Công thức: `HandoverDueTotal = UpfrontTotal - BookingHoldTotal`.
- **LateFeeTotal (Phí trả trễ)**: Phí phát sinh nếu khách trả máy muộn so với giờ hẹn trong đơn.
- **DamageFeeTotal (Phí đền bù hư hỏng)**: Phí đền bù hư hỏng thiết bị hoặc mất phụ kiện được tính sau khi nhân viên làm biên bản kiểm tra trả máy (`ReturnInspection`).
- **PaidTotal (Tổng tiền đã thu)**: Tổng số tiền thực tế khách đã thanh toán được ghi nhận qua các bản ghi `PaymentRecord` thành công.
- **RemainingTotal (Tiền còn nợ)**: Số tiền khách còn nợ shop tại thời điểm hiện tại.
- **RefundTotal (Tiền hoàn cọc)**: Số tiền shop trả lại cho khách sau khi đã trừ phí trễ/hỏng từ khoản cọc ban đầu.
