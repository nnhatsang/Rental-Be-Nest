# Vòng đời đơn thuê và chốt tài chính

> Tài liệu này khớp với các enum và state machine hiện tại trong `prisma/schema.prisma` và `src/modules/rental-orders/domain/rental-order-state-machine.ts`.

## 1. Trạng thái chính của đơn (`OrderStatus`)

| Trạng thái | Ý nghĩa |
| --- | --- |
| `CREATED` | Đơn đã tạo, đang chờ đủ điều kiện thanh toán/xác nhận và giữ máy. |
| `CONFIRMED` | Đã đủ điều kiện bàn giao, allocation vẫn giữ lịch cho đơn. |
| `RENTING` | Đã bàn giao máy cho khách. Nếu quá `endDate` mà chưa trả thì hiển thị quá hạn, không tạo thêm enum `OVERDUE`. |
| `RETURNED` | Khách đã trả máy, đang chờ inspection và tất toán. |
| `DONE` | Đơn hoàn tất vận hành và tài chính. Đây là trạng thái hoàn tất của đơn đã thuê, không dùng cho đơn bị hủy. |
| `CANCELLED` | Đơn bị hủy trước bàn giao; allocation được giải phóng. Trạng thái này không tự biến thành `DONE`. |
| `DISPUTED` | Đơn có tranh chấp cần quản trị viên xử lý đặc biệt. |

State machine hiện tại:

```text
CREATED   -> CONFIRMED -> RENTING -> RETURNED -> DONE
   |             |           |          |
   +-----------> CANCELLED  +-------> DISPUTED
                                  RETURNED <-> DISPUTED -> DONE
```

Các chuyển tiếp thực tế phải dùng state machine, không cập nhật trực tiếp `status` từ controller.

## 2. Trạng thái phụ

- `handoverStatus`: `PENDING_PAYMENT` -> `READY` -> `HANDED_OVER`.
- `returnStatus`: `NOT_RETURNED` -> `RETURNED` -> `INSPECTED`.
- `settlementStatus`: `NOT_STARTED`, `PAYMENT_DUE`, `REFUND_DUE`, `SETTLED`, `DISPUTED`.

`status` trả lời đơn đang ở giai đoạn nào; `settlementStatus` trả lời tiền đã chốt chưa. Hai khái niệm này không được gộp vào một badge.

## 3. Luồng hủy đơn có phát sinh hoàn tiền

Ví dụ: khách đã thanh toán `800.000 đ`, trong đó `50.000 đ` là phí giữ lịch. Khách hủy sát giờ và cửa hàng giữ phí giữ lịch, hoàn lại `750.000 đ`.

### Bước 1: Hủy đơn

API hủy cần ghi nhận:

- `RentalOrder.status = CANCELLED`;
- `cancelReason` và ghi chú của quản trị viên;
- giải phóng toàn bộ `RentalAssetAllocation`;
- giữ lại khoản không hoàn dưới dạng `RentalOrderCharge(kind = CANCELLATION_FEE, amount = 50.000, refundable = false)`;
- các khoản rental/delivery/deposit không còn nghĩa vụ sau hủy được đánh dấu `CANCELLED` hoặc `WAIVED` theo chính sách;
- nếu quản trị viên chọn hoàn ngay, tạo `Refund(amount = 750.000, status = PENDING)`.

Không được hủy `BOOKING_HOLD` thành khoản refundable nếu nghiệp vụ đang giữ phí đặt lịch. Nếu làm vậy, hệ thống sẽ tính nhầm toàn bộ `800.000 đ` là tiền có thể hoàn.

### Bước 2: Xác nhận hoàn tiền

`Refund.PENDING` chỉ là yêu cầu hoàn; chưa được cộng vào `actualRefundTotal`. Khi admin xác nhận giao dịch đã chuyển tiền:

- chuyển `Refund.status` sang `REFUNDED`;
- cập nhật `actualRefundTotal`;
- chạy lại `recalculateOrder` trong cùng transaction.

Sau ví dụ trên, kết quả phải là:

| Trường | Giá trị |
| --- | ---: |
| `paidTotal` | 800.000 đ |
| `actualRefundTotal` | 750.000 đ |
| `totalCustomerObligation` | 50.000 đ |
| `refundDue` | 0 đ |
| `settlementStatus` | `SETTLED` |
| `status` | `CANCELLED` |

### Bước 3: Chốt hủy

“Đóng đơn” trong trường hợp này nên gọi là **Chốt tài chính đơn đã hủy**, không đổi `CANCELLED` thành `DONE`.

Có thể dùng `settlementStatus = SETTLED` làm trạng thái khóa tài chính. Nếu cần nút xác nhận rõ ràng trên UI, bổ sung action `closeCancelledOrder` với các điều kiện:

- đơn có `status = CANCELLED`;
- không còn `Refund` ở `PENDING` hoặc `PROCESSING`;
- `refundDue = 0`;
- không còn `additionalChargeDue` hoặc payment pending;
- các charge đã ở trạng thái cuối (`SETTLED`, `WAIVED` hoặc `CANCELLED`);
- ghi note và actor để audit.

Action này có thể idempotent. Nó không tạo thêm refund, không thay đổi lịch máy và không đổi operational status.

## 4. Quy tắc khóa hoàn tiền

Backend là nguồn quyết định cuối cùng:

- không cho `createRefund` khi `settlementStatus = SETTLED`;
- không cho tổng `PENDING + PROCESSING + REFUNDED` vượt số tiền được hoàn;
- không cho tạo hai yêu cầu vượt số dư do hai admin thao tác đồng thời; tính số dư và tạo refund phải nằm trong cùng transaction;
- sau khi `REFUNDED`, luôn chạy lại `recalculateOrder`;
- UI ẩn nút hoàn tiền khi đã chốt nhưng vẫn hiển thị lịch sử các refund đã tạo.

Thông báo nên rõ với người dùng: “Đơn đã chốt tài chính, đã hoàn đủ số tiền được phép. Không thể tạo thêm yêu cầu hoàn tiền.”

## 5. Nguồn sự thật tài chính

- `RentalOrderCharge`: nghĩa vụ/phí được giữ lại hoặc phải thu.
- `PaymentTransaction` và `PaymentAllocation`: tiền khách đã thanh toán và cách phân bổ.
- `Refund`: yêu cầu và số tiền đã hoàn.
- Các tổng tiền trên `RentalOrder`: projection để đọc nhanh, bắt buộc đồng bộ bằng `recalculateOrder` trong transaction.

`PaymentTransaction.direction = OUTBOUND` chưa được dùng trong flow hiện tại. Giai đoạn này nên coi `Refund` là aggregate hoàn tiền; chỉ thêm payment outbound khi có yêu cầu đối soát giao dịch riêng và phải quy định rõ không được tính trùng với `Refund`.

## 6. Gap hiện tại cần triển khai

- `settleOrder` hiện chỉ chốt đơn `RETURNED`; cần thêm action chốt tài chính cho `CANCELLED` hoặc tự động chốt khi refund đã `REFUNDED` và `refundDue = 0`.
- Nhánh hủy có hoàn tiền hiện cần bảo toàn `BOOKING_HOLD` thành `CANCELLATION_FEE` nếu chính sách giữ phí đặt lịch.
- `createRefund` cần kiểm tra trạng thái `SETTLED` và gộp kiểm tra số dư/tạo refund trong một transaction.
- `RentalOrderLog` cần ghi các action `CANCEL_ORDER`, `CREATE_REFUND`, `CONFIRM_REFUND`, `CLOSE_CANCELLED_ORDER` sau khi service audit được wire.
