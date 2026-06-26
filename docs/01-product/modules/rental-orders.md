# Mô-đun Nghiệp vụ: Đơn thuê & Vận hành (Rental Orders Module)

> Tài liệu mô tả chi tiết yêu cầu sản phẩm cho luồng nghiệp vụ tạo đơn thuê, bàn giao, nhận trả và tất toán tài chính.

---

## 1. Luồng tạo đơn thuê mới (Order Creation Flow)

Khi khách hàng liên hệ trực tiếp tại quầy hoặc qua kênh hỗ trợ (Zalo, điện thoại), nhân viên thực hiện tạo đơn thuê hộ khách hàng qua 4 bước chính:

```text
Bước 1: Chọn hoặc Tạo mới Khách hàng
  ↳ Bước 2: Chọn khoảng thời gian thuê (startDate, endDate)
    ↳ Bước 3: Chọn thiết bị cần thuê & Kiểm tra lịch khả dụng
      ↳ Bước 4: Xem bảng tính tiền dự kiến (Giá thuê, Tiền cọc, Tiền thu trước)
        ↳ Lưu đơn dưới dạng DRAFT hoặc xác nhận cọc để chuyển CONFIRMED
```

- **Lưu nháp (`DRAFT`)**: Cho phép lưu đơn khi thông tin chưa đầy đủ (ví dụ: chưa chọn thiết bị vật lý cụ thể, khách chưa chuyển khoản cọc). Trạng thái này không chặn lịch của máy trong kho.
- **Xác nhận giữ máy (`CONFIRMED`)**: Khi khách chuyển khoản cọc giữ máy (`BookingHoldTotal`), nhân viên cập nhật đơn sang `CONFIRMED`. Hệ thống bắt đầu khóa lịch của thiết bị.

---

## 2. Hình thức nhận máy (Pickup Methods)

Hệ thống hỗ trợ 2 hình thức bàn giao máy cho khách:

### 2.1 Nhận tại cửa hàng (`PICKUP_AT_STORE`)
- Khách hàng trực tiếp đến quầy giao dịch của shop.
- Nhân viên kho tiến hành checklist phụ kiện, kiểm tra ngoại quan cùng khách và làm thủ tục bàn giao trên ứng dụng.
- Không phát sinh phí giao hàng.

### 2.2 Shop giao hàng (`DELIVERY`)
- Nhân viên tạo đơn nhập địa chỉ giao hàng và ghi nhận phí giao hàng (`deliveryFeeTotal`) tính thêm vào đơn thuê.
- Thiết bị được bàn giao cho shipper mang đến nhà khách.
- Đơn hàng chuyển trạng thái sang `DELIVERING` khi shipper lấy máy đi, và chuyển thành `RENTING` khi khách ký nhận thành công.

---

## 3. Thủ tục bàn giao & Nhận trả thiết bị

### 3.1 Biên bản bàn giao (`OrderHandover`)
- Khi giao máy: Nhân viên lập biên bản giao (`type = OUTGOING`), checklist danh sách phụ kiện kèm theo (ví dụ: Lens Sony A7 IV đi kèm 1 pin zin, 1 sạc, 1 thẻ nhớ 64GB, 1 túi xách). Lưu lại ghi chú tình trạng máy (ví dụ: máy sạch, ống kính không trầy xước).
- Khi khách trả máy: Nhân viên lập biên bản nhận lại (`type = RETURN`), đối chiếu lại danh sách phụ kiện xem có bị thiếu hoặc hư hỏng không.

### 3.2 Biên bản kiểm tra trả máy (`ReturnInspection`)
Sau khi nhận máy từ khách, nhân viên kỹ thuật thực hiện kiểm tra chi tiết thiết bị:
- **Tình trạng tốt**: Xác nhận trả máy thành công, chuyển thiết bị vật lý về trạng thái `AVAILABLE`.
- **Trễ hạn**: Hệ thống tự động tính toán phí phạt trễ hạn dựa trên giá quá giờ (`hourlyOveragePrice`) của sản phẩm nhân với số giờ trễ thực tế.
- **Hư hỏng / Mất phụ kiện**: Nhân viên tạo các báo cáo hư hỏng (`DamageReport`) đính kèm biên bản kiểm tra, ghi nhận mức phí phạt đền bù dự kiến (`estimatedFee`).

---

## 4. Nhật ký thanh toán & Tất toán đơn hàng

Mọi dòng tiền thu/chi của đơn thuê đều được quản lý thông qua các bản ghi giao dịch thủ công (`PaymentRecord`):

### Các loại giao dịch (`PaymentKind`)
- **`DEPOSIT` (Thu tiền cọc)**: Ghi nhận tiền đặt cọc giữ tài sản.
- **`RENTAL_FEE` (Thu tiền thuê)**: Ghi nhận tiền thanh toán dịch vụ thuê máy.
- **`LATE_FEE` (Thu tiền phạt trễ)**: Ghi nhận tiền phạt quá giờ.
- **`DAMAGE_FEE` (Thu tiền đền bù)**: Ghi nhận tiền phạt do làm hỏng/mất thiết bị.
- **`REFUND` (Hoàn trả tiền)**: Hoàn trả lại tiền cọc hoặc tiền thừa cho khách khi thanh lý đơn.

### Trạng thái thanh toán đơn (`PaymentStatus`)
- **`UNPAID`**: Chưa thanh toán đồng nào.
- **`PARTIALLY_PAID`**: Đã cọc giữ máy hoặc trả một phần tiền thuê.
- **`PAID`**: Đã thanh toán đầy đủ toàn bộ số tiền cần thu trước khi giao máy (`UpfrontTotal`).
- **`REFUNDED`**: Đã hoàn tất hoàn cọc và tất toán đơn hàng.
