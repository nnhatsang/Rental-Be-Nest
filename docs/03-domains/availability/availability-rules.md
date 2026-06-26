# Luật kiểm tra lịch trống & Tính toán giá thuê (Availability & Pricing)

> Tài liệu mô tả chi tiết logic kiểm tra khả dụng của thiết bị để tránh trùng lịch (Overbooking) và thuật toán tính giá thuê theo biểu giá bậc thang (Rental Price Tiers).

---

## 1. Cơ chế kiểm tra lịch trùng (Availability Check)

Để đảm bảo một chiếc máy ảnh vật lý (`AssetUnit`) không bị gán đồng thời cho hai khách hàng khác nhau trong cùng một khoảng thời gian, hệ thống sử dụng cơ chế kiểm tra lịch trùng dựa trên giao thoa thời gian (Time Overlap).

### 1.1 Trạng thái đơn chặn lịch (Blocking Statuses)
Chỉ các đơn thuê nằm trong danh sách trạng thái sau mới bị coi là chặn lịch của thiết bị:
- `CONFIRMED`
- `PREPARING`
- `READY_FOR_PICKUP`
- `DELIVERING`
- `RENTING`
- `OVERDUE`

### 1.2 Công thức tính khoảng thời gian bận
Khi khách đặt lịch thuê từ thời điểm `new.startDate` đến `new.endDate`, hệ thống sẽ tính khoảng chặn lịch thực tế bao gồm cả thời gian giãn cách dọn dẹp/sạc pin (`turnaroundMinutes` lấy từ `RentalPolicy` áp dụng cho đơn, mặc định là 60 phút):
- **Thời điểm chặn bắt đầu**: `new.startDate`
- **Thời điểm chặn kết thúc**: `blockedEndDate = new.endDate + turnaroundMinutes`

### 1.3 Công thức giao thoa thời gian (Overlap Formula)
Hai khoảng thời gian thuê (Đơn hiện tại `existing` đã bận và Đơn mới `new` đang kiểm tra) bị coi là trùng lịch khi và chỉ khi thỏa mãn điều kiện sau:

```text
existing.startDate < new.blockedEndDate AND existing.blockedEndDate > new.startDate
```

*Nếu điều kiện trên trả về TRUE, thiết bị đó được coi là ĐÃ BẬN (Unavailable) trong khoảng thời gian của đơn mới.*

---

## 2. Quy trình kiểm tra khả dụng khi tạo đơn

Khi nhân viên tạo đơn thuê hoặc kiểm tra nhanh lịch trống tại màn hình `/availability`:

### Bước 1: Kiểm tra theo Dòng sản phẩm (`Product`)
Nếu nhân viên chỉ chọn dòng sản phẩm chung (chưa chỉ định số Serial cụ thể):
1. Tìm tất cả các thiết bị vật lý `AssetUnit` thuộc dòng sản phẩm đó đang có trạng thái hoạt động tốt (`isActive = true`, `status != DAMAGED`). Gọi tổng số máy khả dụng là $N$.
2. Đếm số lượng máy đã bị gán trong các đơn thuê trùng lịch (theo công thức Overlap ở trên) trong khoảng thời gian yêu cầu. Gọi số máy đã bận là $B$.
3. Số lượng máy khả dụng còn lại: $A = N - B$.
4. **Kết luận**: Nếu $A > 0$, khách hàng có thể đặt thuê dòng sản phẩm này. Nếu $A \le 0$, hệ thống báo hết máy.

### Bước 2: Kiểm tra theo Thiết bị vật lý con (`AssetUnit`)
Nếu nhân viên chỉ định đích danh số Serial của máy (ví dụ gán máy ảnh SN001 vào dòng đơn):
1. Hệ thống kiểm tra xem máy SN001 có đơn thuê nào khác bị trùng lịch (Overlap) hay không.
2. Kiểm tra trạng thái hiện tại của máy trong kho: nếu máy đang ở trạng thái `MAINTENANCE` hoặc `DAMAGED` thì cũng bị coi là không khả dụng kể cả lịch trống.

---

## 3. Thuật toán tính giá thuê bậc thang (Pricing Tiers)

Để khuyến khích khách thuê dài ngày, hệ thống hỗ trợ cấu hình giá thuê giảm dần theo số ngày thuê (Price Tiers).

### 3.1 Quy tắc tính số ngày thuê
- Số ngày thuê được tính bằng khoảng cách giữa `startDate` và `endDate` (tính theo đơn vị ngày, làm tròn lên).
- Ví dụ: Thuê từ 08:00 sáng ngày 26/06 đến 18:00 chiều ngày 27/06 được tính là **2 ngày**.

### 3.2 Thuật toán áp dụng giá thuê
Khi tính tiền thuê cho một dòng sản phẩm (`Product`), hệ thống thực hiện các bước sau:
1. Tính số ngày thuê thực tế của đơn hàng: $D$.
2. Truy vấn danh sách các bậc giá (`ProductRentalPriceTier`) của sản phẩm đó trong database:
   - Sắp xếp các bậc giá theo thứ tự ngày tăng dần.
3. Đối chiếu số ngày $D$ với khoảng áp dụng của từng bậc giá:
   - Bậc giá khớp nếu thỏa mãn: `minDays <= D` và (`maxDays >= D` hoặc `maxDays IS NULL`).
4. **Kết quả**:
   - Nếu tìm thấy bậc giá phù hợp: Đơn giá thuê ngày của dòng sản phẩm đó sẽ được tính theo `dailyPrice` của bậc giá đó.
   - Nếu không tìm thấy bậc giá nào phù hợp: Hệ thống sử dụng giá thuê ngày mặc định (`Product.dailyPrice`).
5. **Tổng tiền thuê của dòng**: `lineTotal = đơn_giá_áp_dụng * D * số_lượng`.
