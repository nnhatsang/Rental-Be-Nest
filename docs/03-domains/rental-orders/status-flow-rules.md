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

Ví dụ: khách đã thanh toán `800.000 đ`, trong đó `50.000 đ` là phí giữ lịch. Khi hủy, quản trị viên được quyết định hoàn `300.000 đ`, `750.000 đ` hoặc toàn bộ `800.000 đ`; hệ thống không tự động trừ phí giữ lịch khỏi mức hoàn tối đa.

### Bước 1: Hủy đơn

API hủy cần ghi nhận:

- `RentalOrder.status = CANCELLED`;
- `cancelReason` và ghi chú của quản trị viên;
- giải phóng toàn bộ `RentalAssetAllocation`;
- hủy các charge chưa còn nghĩa vụ sau hủy, bao gồm `BOOKING_HOLD`, `RENTAL_FEE`, `DELIVERY_FEE` và `SECURITY_DEPOSIT`;
- nếu quản trị viên chọn hoàn ngay, tạo `Refund(amount = refundAmount, status = PENDING)`.

`refundAmount` là số tiền hoàn ở lần hiện tại, phải thỏa:

```text
0 <= refundAmount <= paidTotal - actualRefundTotal - pendingRefundTotal
```

Nếu không chọn hoàn ngay, đơn vẫn có thể tạo yêu cầu hoàn sau bằng action hoàn tiền. Việc hủy đơn không tự biến phần còn lại thành phí hủy, vì quản trị viên có thể muốn hoàn toàn bộ hoặc hoàn một phần tùy trường hợp.

### Bước 2: Xác nhận hoàn tiền

`Refund.PENDING` chỉ là yêu cầu hoàn; chưa được cộng vào `actualRefundTotal`. Khi admin xác nhận giao dịch đã chuyển tiền:

- chuyển `Refund.status` sang `REFUNDED`;
- cập nhật `actualRefundTotal`;
- chạy lại `recalculateOrder` trong cùng transaction.

Ví dụ hoàn `750.000 đ`, sau khi xác nhận kết quả là:

| Trường | Giá trị |
| --- | ---: |
| `paidTotal` | 800.000 đ |
| `actualRefundTotal` | 750.000 đ |
| `totalCustomerObligation` | 0 đ |
| `refundDue` | 50.000 đ |
| `settlementStatus` | `REFUND_DUE` |
| `status` | `CANCELLED` |

Lúc này quản trị viên có hai lựa chọn: hoàn tiếp `50.000 đ`, hoặc chốt giữ lại phần này và khóa xử lý hoàn.

### Bước 3: Chốt phần còn lại

“Đóng đơn” nên gọi là **Chốt phần còn lại của đơn đã hủy**, không đổi `CANCELLED` thành `DONE`.

API `POST /rental-orders/:id/close-cancellation` thực hiện:

- chỉ cho đơn có `status = CANCELLED`;
- không cho chốt khi còn `Refund` ở `PENDING` hoặc `PROCESSING`;
- ghi note bắt buộc và actor để audit;
- đặt `settlementStatus = SETTLED` để khóa nghiệp vụ hoàn tiền;
- giữ nguyên `refundDue` gốc để bảo toàn số liệu đối soát, nhưng trả `refundableRemaining = 0` và không cho tạo/confirm refund tiếp.

Nếu quản trị viên hoàn đủ `800.000 đ` thì `refundDue = 0` và hệ thống tự khóa hoàn; không cần gọi endpoint chốt phần còn lại. Nếu chỉ hoàn một phần rồi gọi endpoint này, phần còn lại vẫn có thể xuất hiện trong `refundDue` để đối soát nhưng không còn là khoản được phép thao tác. Action chốt có tính idempotent khi đơn đã `SETTLED`, không tạo thêm phí.

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

## 6. Gap còn lại sau khi triển khai flow hoàn tiền

- `settleOrder` vẫn chỉ dùng cho đơn đã trả máy; đơn `CANCELLED` được chốt bằng `settlementStatus = SETTLED` hoặc endpoint `close-cancellation`.
- `RentalOrderLog` hiện ghi nhận `CLOSE_CANCELLED_ORDER`; các action `CANCEL_ORDER`, `CREATE_REFUND`, `CONFIRM_REFUND` vẫn là phần audit tiếp theo.

## 7. Quy tắc đã triển khai cho hoàn tiền từng phần

Request hủy đơn dùng các trường sau:

- `allowRefund`: tạo yêu cầu hoàn ngay trong transaction hủy đơn; giá trị `false` chỉ hủy đơn và không tự chuyển tiền.
- `refundAmount`: số tiền muốn tạo yêu cầu hoàn ở lần hiện tại; có thể nhỏ hơn mức tối đa để hoàn từng phần.

Quy trình chuẩn:

1. Hệ thống tính `paidTotal - actualRefundTotal - pendingRefundTotal`.
2. Không tự trừ `bookingHoldTotal` khỏi mức tối đa. Phí giữ lịch chỉ trở thành `CANCELLATION_FEE` khi quản trị viên chủ động chốt phần còn lại.
3. Tạo tối đa một yêu cầu `Refund.PENDING`/`PROCESSING` tại một thời điểm. Phải xác nhận khoản hiện tại trước khi tạo khoản tiếp theo.
4. Khi quản trị viên xác nhận đã chuyển tiền, chuyển refund sang `REFUNDED` và chạy lại `recalculateOrder` trong transaction.
5. Nếu vẫn còn số dư và chưa chốt, đơn giữ `settlementStatus = REFUND_DUE`; nếu `refundableRemaining = 0` do đã hoàn đủ hoặc đã chốt, thao tác hoàn bị khóa.

Với đơn `CANCELLED`, `settlementStatus` được xác định theo số tiền khách đã trả còn chưa hoàn (`paidTotal - actualRefundTotal`), không chỉ theo `refundDue`. Nhờ vậy, khoản phí hủy/giữ lịch trong sổ không vô tình khóa quyền hoàn phần tiền khách vẫn có thể được hoàn.

API trả thêm hai projection để FE không phải tự suy diễn:

- `pendingRefundTotal`: tổng yêu cầu hoàn đang chờ xác nhận/đang xử lý;
- `refundableRemaining`: số tiền còn được phép tạo yêu cầu hoàn mới.

Ví dụ khách đã trả 800.000 đồng, trong đó có 50.000 đồng phí đặt lịch: mức hoàn tối đa ban đầu vẫn là 800.000 đồng. Có thể nhập hoàn 500.000 đồng trước, sau khi xác nhận hệ thống còn cho phép hoàn 300.000 đồng; nếu muốn kết thúc xử lý mà không hoàn tiếp, dùng `close-cancellation`. Khi đó backend khóa `settlementStatus = SETTLED`; `refundDue` có thể còn 300.000 đồng để đối soát nhưng `refundableRemaining = 0`.

Nếu quản trị viên quyết định hoàn ít hơn mức còn được hoàn và giữ lại phần dư, dùng `POST /rental-orders/:id/close-cancellation` với `note` bắt buộc. Backend ghi audit, khóa `settlementStatus = SETTLED` và không tạo thêm khoản phí tự động. Endpoint này không được chạy khi còn refund `PENDING`/`PROCESSING`, vì phải xác nhận hoặc xử lý khoản hoàn đang treo trước.
