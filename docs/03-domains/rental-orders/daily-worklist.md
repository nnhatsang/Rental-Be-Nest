# Công việc vận hành trong ngày

> Backlog nghiệp vụ cho khu vực “hôm nay cần làm gì” trên `rental-orders` và `availability/Gantt`. Tài liệu này ghi nhận định hướng, chưa triển khai API hoặc UI.

## 1. Mục tiêu

Quản trị viên cần nhìn thấy nhanh:

- đơn nào hôm nay cần bàn giao máy;
- đơn nào cần thu hoặc xác nhận thanh toán trước khi giao máy;
- đơn nào cần nhận trả và kiểm tra thiết bị;
- đơn nào đã quá hạn trả;
- đơn nào còn nghĩa vụ hoàn tiền hoặc đang tranh chấp;
- thời điểm, khách hàng, sản phẩm và số tiền liên quan đến từng việc.

> Khu vực công việc phải độc lập với phân trang của bảng đơn thuê. Không được chỉ lấy trang hiện tại của danh sách đơn để suy ra toàn bộ việc cần làm trong ngày.

## 2. Vấn đề của danh sách đơn hiện tại

`GET /rental-orders` là danh sách phân trang và thường được lọc theo `startDate`. Nếu dùng endpoint này để tự tính việc trong ngày, hệ thống có thể bỏ sót:

- đơn bắt đầu từ hôm trước nhưng hôm nay đến hạn trả;
- đơn nằm ở trang sau đang chờ thanh toán hoặc bàn giao;
- đơn đã quá hạn trả nhưng không nằm trong khoảng ngày tạo/khởi hành đang xem;
- nhiều việc thuộc các đơn khác nhau khi chúng không xuất hiện trong page hiện tại.

Frontend không nên tải toàn bộ đơn về rồi tự đếm. Điều kiện nghiệp vụ, tổng số và thứ tự ưu tiên cần được xử lý ở backend để kết quả không phụ thuộc vào `perPage`.

## 3. API đề xuất

Tạo endpoint riêng, không thay thế `GET /rental-orders`:

```http
GET /api/rental-orders/worklist
```

Query đề xuất:

| Tham số | Ý nghĩa |
| --- | --- |
| `fromDate` | Mốc bắt đầu, bắt buộc khi gọi rõ khoảng thời gian |
| `toDate` | Mốc kết thúc, bắt buộc khi gọi rõ khoảng thời gian |
| `timezone` | Múi giờ diễn giải ngày, mặc định `Asia/Ho_Chi_Minh` |
| `includeCancelled` | Có đưa việc còn nghĩa vụ hoàn tiền của đơn đã hủy hay không, mặc định `false` |
| `types[]` | Lọc loại công việc |
| `customerId` | Lọc theo khách hàng |
| `productId` | Lọc theo sản phẩm |
| `page`, `perPage` | Phân trang work item, mặc định `perPage = 20` |

Quy ước khoảng thời gian là `[fromDate, toDate)`. Khi không truyền ngày, backend dùng ngày hiện tại đến đầu ngày kế tiếp theo `Asia/Ho_Chi_Minh`.

Điều kiện tạo work item:

- `PICKUP`: `startDate` nằm trong khoảng xem và đơn cần bàn giao;
- `PAYMENT`: còn số tiền phải thu trước bàn giao hoặc có khoản thanh toán cần xác nhận;
- `RETURN`: `endDate` nằm trong khoảng xem và đơn cần nhận trả;
- `OVERDUE_RETURN`: đã quá `endDate`, chưa có `actualReturnDate`;
- `INSPECTION`: đã nhận máy nhưng chưa hoàn tất kiểm tra;
- `REFUND`: còn số tiền phải hoàn hoặc có yêu cầu hoàn tiền chờ xử lý;
- `DISPUTE`: đơn đang ở trạng thái tranh chấp.

Một đơn có thể tạo nhiều work item trong cùng thời điểm. Đây là chủ ý: bảng công việc trả lời “cần làm gì”, không chỉ trả lời “có những đơn nào”.

## 4. Loại công việc và mức ưu tiên

| Type | Nhãn hiển thị | Ý nghĩa |
| --- | --- | --- |
| `DISPUTE` | Tranh chấp | Cần người có thẩm quyền xử lý |
| `OVERDUE_RETURN` | Trả máy quá hạn | Đã quá giờ trả, cần liên hệ/xử lý ngay |
| `REFUND` | Hoàn tiền | Cần tạo, duyệt hoặc xác nhận hoàn tiền |
| `PAYMENT` | Thanh toán | Cần thu hoặc xác nhận khoản tiền |
| `INSPECTION` | Kiểm tra máy | Cần kiểm tra tình trạng sau khi nhận trả |
| `PICKUP` | Bàn giao máy | Chuẩn bị và giao máy cho khách |
| `RETURN` | Nhận trả máy | Tiếp nhận máy theo lịch |

Thứ tự ưu tiên mặc định: `DISPUTE`, `OVERDUE_RETURN`, `REFUND`, `PAYMENT`, `INSPECTION`, `PICKUP`, `RETURN`. Trong cùng một loại, sắp xếp `dueAt` tăng dần và đưa việc đã quá hạn lên trước.

## 5. Response đề xuất

Mỗi item nên là một DTO đã được backend chuẩn hóa để frontend không phải suy diễn trạng thái:

```ts
type RentalOrderWorkItem = {
  id: string;
  type: 'PICKUP' | 'PAYMENT' | 'RETURN' | 'OVERDUE_RETURN' | 'INSPECTION' | 'REFUND' | 'DISPUTE';
  priority: 'URGENT' | 'HIGH' | 'NORMAL';
  orderId: string;
  orderCode: string;
  orderStatus: string;
  customerName: string;
  customerPhone?: string | null;
  productSummary: string;
  dueAt: string;
  startDate: string;
  endDate: string;
  amount?: number | null;
  amountLabel?: string | null;
  message: string;
  handoverStatus: string;
  returnStatus: string;
  settlementStatus: string;
};
```

Response cần có summary và pagination riêng:

```ts
type RentalOrderWorklistResponse = {
  items: RentalOrderWorkItem[];
  summary: {
    totalTasks: number;
    totalOrders: number;
    pickup: number;
    payment: number;
    return: number;
    overdueReturn: number;
    inspection: number;
    refund: number;
    dispute: number;
  };
  pagination: {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
  };
  fromDate: string;
  toDate: string;
  timezone: string;
};
```

`amount` chỉ chứa số tiền liên quan trực tiếp đến công việc; không dùng `paidTotal` để gắn nhãn doanh thu và không tính lại tiền ở frontend.

## 6. UI dự kiến trong module `rental-orders`

Đặt một khu vực độc lập phía trên bảng đơn thuê:

```text
Công việc trong ngày · 03/10/2026
[Tất cả 7] [Bàn giao 2] [Thanh toán 2] [Trả máy 1] [Hoàn tiền 1]

09:00  Bàn giao máy   #ORD-... · Nguyễn Văn A · Fujifilm X-A5
       Chuẩn bị 1 máy · Còn phải thu 500.000 đ
       [Mở đơn] [Xử lý]
```

Nguyên tắc UI:

- query worklist riêng, mặc định hiển thị hôm nay;
- cho phép chuyển nhanh `Hôm nay`, `Ngày mai`, `7 ngày tới`;
- hiển thị số lượng theo summary server, không đếm từ danh sách đang có trên màn hình;
- mở detail/action của đơn khi bấm vào item;
- có loading, empty state, error state và số việc còn lại khi worklist được phân trang;
- trên mobile chuyển thành danh sách dọc, không ép thành bảng nhiều cột.

## 7. Ranh giới với availability/Gantt

Gantt vẫn là màn hình lịch thiết bị: trả lời máy nào đang có allocation, thời gian nào bị giao nhau và click vào lịch để mở chi tiết đơn. Worklist có thể đặt phía trên hoặc trong panel thu gọn của Gantt, nhưng không trộn work item vào resource row.

Các summary hiện có của Gantt vẫn có thể giữ ở vai trò phụ:

- tổng thiết bị;
- đang có lịch;
- trống theo lịch;
- không khả dụng.

Không bổ sung thêm các card tổng hợp `bảo trì`, `mất`, `hư hỏng`, `máy đang tắt` nếu asset-unit đã có badge và bộ lọc cho các trạng thái đó. Tránh lặp số liệu và tránh làm người dùng hiểu các nhóm là loại trừ tuyệt đối khi chúng có thể chồng lấp.

Trạng thái vật lý của máy nằm ở asset row/badge/filter; công việc xử lý đơn nằm ở worklist, tooltip và detail dialog.

## 8. Ranh giới với Dashboard

Dashboard vận hành chỉ hiển thị preview ngắn để điều hướng nhanh. `attentionPreview` không thay thế worklist đầy đủ.

- Dashboard: tổng quan, cảnh báo nổi bật, preview giới hạn;
- rental-orders: danh sách đầy đủ các việc cần xử lý, có phân trang và action;
- availability/Gantt: lịch tài sản và xung đột allocation;
- rental-order detail: toàn bộ ngữ cảnh và thao tác của một đơn.

## 9. Acceptance criteria cho backlog

- Đơn bắt đầu từ hôm trước nhưng hôm nay trả máy phải xuất hiện trong `RETURN`.
- Đơn nằm ở page sau của danh sách vẫn phải xuất hiện nếu có việc đến hạn.
- Một đơn có thể xuất hiện nhiều dòng khi có nhiều việc độc lập.
- `summary.totalTasks` không thay đổi theo `perPage`.
- Frontend không suy diễn tiền hoặc trạng thái chỉ từ màu badge.
- Đơn đã hủy không tạo `PICKUP`, `PAYMENT`, `RETURN`; chỉ tạo `REFUND` nếu còn nghĩa vụ hoàn tiền.
- Sau mutation thanh toán, bàn giao, nhận trả, kiểm tra hoặc hoàn tiền, worklist phải được invalidate/refetch.
- Không tạo thêm nhóm summary tài sản trùng với badge/filter của asset-unit.
