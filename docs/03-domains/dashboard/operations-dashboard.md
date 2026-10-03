# Operations Dashboard

## Mục tiêu

Dashboard vận hành giúp admin biết việc cần xử lý trong kỳ xem và mở nhanh đúng module chi tiết. Màn hình tổng hợp không giữ state nghiệp vụ riêng và không thay thế rental-orders, availability hoặc reports.

## API v1

```text
GET /api/dashboard/operations/overview
GET /api/dashboard/operations/attention
GET /api/dashboard/operations/trends
```

Tất cả endpoint yêu cầu `orders.read`.

### Query chung

```text
fromDate       required ISO datetime
toDate         required ISO datetime
timezone       optional IANA timezone; default Asia/Ho_Chi_Minh
includeCancelled optional boolean; default false
```

Khoảng thời gian dùng `[fromDate, toDate)`, tối đa 366 ngày. `fromDate` và `toDate` được frontend gửi kèm offset; backend không suy đoán ngày từ timezone của máy chủ.

## Ngữ nghĩa số liệu

Dashboard v1 dùng `RENTAL_PERIOD`. Một đơn thuộc kỳ nếu khoảng thuê giao nhau với khoảng dashboard:

```text
order.startDate < toDate
AND order.endDate > fromDate
```

Các mốc nhận/trả dùng điều kiện riêng:

```text
pickup: startDate >= fromDate AND startDate < toDate
return: endDate >= fromDate AND endDate < toDate
```

Đơn đang quá hạn được đưa vào attention dù bắt đầu trước kỳ xem để admin không bỏ sót việc khẩn cấp.

Đơn hủy không được tính vào các KPI vận hành thông thường khi `includeCancelled=false`. Tuy nhiên `cancelledOrders`, `refundDueTotal`, `pendingRefundTotal` và attention loại `REFUND_PENDING` vẫn rà cả đơn hủy trong kỳ để không bỏ sót nghĩa vụ hoàn tiền.

### Tài chính

| Field | Ý nghĩa |
| --- | --- |
| rentalRevenue | Tổng `rentalFeeTotal` trên các đơn trong kỳ |
| deliveryRevenue | Tổng `deliveryFeeTotal` |
| collectedTotal | Tổng `paidTotal`; có thể gồm tiền thuê, giữ lịch và cọc |
| depositHeldTotal | Ước tính cọc snapshot trừ hoàn thực tế |
| amountDueBeforeHandover | Còn phải thu trước khi bàn giao |
| refundDueTotal | Nghĩa vụ cần hoàn theo order snapshot |
| pendingRefundTotal | Refund đang PENDING hoặc PROCESSING; refund của đơn hủy vẫn được tính để không bỏ sót việc hoàn tiền |
| damageCompensationTotal | Bồi thường hư hỏng tính cho khách |
| repairCostTotal | `null` khi chưa có module ghi nhận chi phí sửa chữa |

`collectedTotal` không được hiển thị với label “Doanh thu”. Tiền cọc không phải doanh thu. `damageCompensationTotal` không được dùng thay cho chi phí sửa chữa thực tế.

## Attention workflow

Một order chỉ xuất hiện một lần trong attention list. Service chọn loại việc theo thứ tự:

```text
DISPUTE
OVERDUE_RETURN
REFUND_PENDING
PAYMENT_CONFIRMATION
PICKUP_DUE
RETURN_DUE
```

| Type | Điều kiện | Priority |
| --- | --- | --- |
| DISPUTE | order.status = DISPUTED | HIGH |
| OVERDUE_RETURN | RENTING + endDate đã qua + chưa actualReturnDate | HIGH |
| REFUND_PENDING | refundDue > 0 hoặc có refund PENDING/PROCESSING | HIGH |
| PAYMENT_CONFIRMATION | amountDueBeforeHandover > 0 hoặc payment inbound PENDING | MEDIUM |
| PICKUP_DUE | startDate trong kỳ + chưa HANDED_OVER | MEDIUM |
| RETURN_DUE | endDate trong kỳ + chưa INSPECTED | MEDIUM |

## Top products

Top products lấy từ `RentalOrderLine` của các order không bị hủy mặc định. Mỗi item trả:

- `rentedQuantity`: tổng quantity;
- `rentalOrderCount`: số line/order có sản phẩm;
- `rentalDeviceDays`: số ngày thuê nhân quantity;
- `rentalRevenue`: tổng `lineRentalTotal`.

Dashboard chỉ trả top 5. Danh sách xếp hạng đầy đủ nên đặt ở reports hoặc products analytics.

## Top thiết bị

`topAssets` trả tối đa 5 máy có số lần được giao/đã trả nhiều nhất trong kỳ. Chỉ allocation ở trạng thái `HANDED_OVER` hoặc `RETURNED` được tính; allocation mới giữ lịch (`RESERVED`) chưa được xem là lượt thuê thực tế.

Mỗi item gồm:

- `serialNumber`: số serial của máy;
- `productName`: sản phẩm mà máy thuộc về;
- `rentalCount`: số lượt allocation thực tế;
- `rentalDeviceDays`: tổng số ngày máy được ghi nhận trong các allocation đó.

Nếu cần xem toàn bộ máy, lịch chi tiết hoặc phân tích tỷ lệ sử dụng, frontend nên điều hướng sang availability/Gantt hoặc một báo cáo tài sản riêng; dashboard chỉ giữ danh sách nổi bật để đọc nhanh.

## Trends

`/operations/trends` hỗ trợ `DAY`, `WEEK`, `MONTH`. Bucket được tạo theo timezone request nhưng số tiền vẫn lấy từ snapshot order theo `startDate`.

Trends chưa phải báo cáo dòng tiền. Khi cần thống kê thu/hoàn theo ngày giao dịch, query phải dựa trên `PaymentTransaction.createdAt` và `Refund.createdAt` trong module reports.

## Realtime

V1 không phát aggregate qua socket. Frontend polling overview/attention theo chu kỳ khoảng 30 giây và refresh sau mutation. Giai đoạn sau có thể phát event invalidation cho order, payment, refund, handover, return, inspection và asset status.

## Ranh giới với worklist vận hành trong ngày

`attentionPreview` của Dashboard chỉ là preview giới hạn, thường một item cho mỗi đơn để quản trị viên biết nơi cần mở tiếp. Nó không thay thế worklist đầy đủ của module `rental-orders`.

Khi cần trả lời câu hỏi “hôm nay cần làm gì”, hệ thống phải dùng tài liệu [daily-worklist.md](../rental-orders/daily-worklist.md):

- query độc lập với phân trang của `GET /rental-orders`;
- xét cả lịch bàn giao, lịch trả, quá hạn, thanh toán, kiểm tra, hoàn tiền và tranh chấp;
- một đơn có thể sinh nhiều work item;
- tổng số công việc do backend trả về, không đếm từ các item preview ở frontend.

Gantt có thể hiển thị worklist ở khu vực phụ hoặc panel thu gọn, nhưng vai trò chính vẫn là lịch tài sản và allocation. Không dùng Dashboard để thay thế detail/action của đơn thuê.

## Capability chưa có dữ liệu

- Chi phí sửa chữa cần bảng chi phí bảo trì hoặc chi phí incident riêng.
- Báo cáo tài chính cần định nghĩa ngày ghi nhận doanh thu.
- Audit log dashboard cần audit contract toàn hệ thống.
- Blacklist cần model, thời hạn và rule chặn tạo order.

