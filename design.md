# Design nghiệp vụ và giao diện Admin Rental

Tài liệu này mô tả nghiệp vụ cần xử lý và định hướng giao diện cho hệ thống quản lý cho thuê thiết bị quay/chụp theo hướng admin-first.

Phạm vi hiện tại là Phase 1: nhân viên/admin thao tác nội bộ để tạo đơn thuê, chọn khách hàng, chọn sản phẩm hoặc thiết bị vật lý, ghi nhận thanh toán thủ công, bàn giao, nhận trả, kiểm tra thiết bị và tất toán.

Không thiết kế giỏ hàng, checkout tự phục vụ, callback cổng thanh toán hoặc luồng khách tự đặt đơn trong Phase 1.

## 1. Mục tiêu sản phẩm

Hệ thống cần giúp cửa hàng quản lý toàn bộ vòng đời cho thuê thiết bị camera/video:

- Quản lý danh mục sản phẩm cho thuê như máy ảnh, lens, đèn, gimbal, micro.
- Quản lý thiết bị vật lý theo serial nếu cửa hàng có theo dõi từng máy.
- Tạo và xử lý đơn thuê thủ công bởi admin/nhân viên.
- Kiểm tra khả dụng theo thời gian thuê để tránh trùng lịch.
- Ghi nhận tiền cọc, tiền thuê, phí giao hàng, phí trễ, phí hư hỏng và hoàn tiền.
- Theo dõi trạng thái đơn từ nháp đến hoàn tất.
- Lưu snapshot giá và thông tin sản phẩm tại thời điểm tạo đơn.
- Lưu lịch sử thao tác và thay đổi trạng thái để audit.
- Phân quyền bằng RBAC cho admin, quản lý, nhân viên, viewer.

## 2. Người dùng hệ thống

### Admin

Admin có quyền cao nhất trong hệ thống:

- Quản lý tài khoản người dùng.
- Quản lý vai trò và quyền.
- Quản lý toàn bộ sản phẩm, thiết bị, khách hàng, đơn thuê, thanh toán, báo cáo.
- Có thể sửa các thông tin nhạy cảm nếu nghiệp vụ cho phép.

### Manager

Manager quản lý vận hành hằng ngày:

- Xem dashboard và báo cáo.
- Duyệt, cập nhật, hủy, hoàn tiền đơn thuê.
- Gán nhân viên phụ trách đơn.
- Theo dõi tồn kho, thiết bị, lịch thuê.
- Kiểm tra các đơn quá hạn hoặc tranh chấp.

### Staff

Staff xử lý nghiệp vụ tại quầy/kho:

- Tạo đơn thuê cho khách.
- Cập nhật thông tin khách hàng.
- Chuẩn bị thiết bị.
- Bàn giao thiết bị.
- Ghi nhận thanh toán thủ công nếu được cấp quyền.
- Nhận trả và ghi nhận tình trạng thiết bị.

### Viewer

Viewer chỉ xem dữ liệu:

- Xem đơn thuê, khách hàng, sản phẩm, thiết bị, báo cáo.
- Không được tạo, sửa, xóa hoặc chuyển trạng thái.

## 3. Điều hướng tổng thể

Sidebar admin nên có các nhóm chính:

- Dashboard
- Đơn thuê
- Khách hàng
- Sản phẩm
- Thiết bị vật lý
- Thanh toán
- Trả hàng và kiểm tra
- Báo cáo
- Người dùng
- Vai trò và quyền
- Cấu hình

Giao diện ưu tiên vận hành nội bộ: nhanh, rõ trạng thái, nhiều bộ lọc, bảng dữ liệu dày vừa phải, hành động chính dễ tìm.

## 3.1. Danh sách trang cần xây dựng

Phần này là sitemap/backlog màn hình cho frontend admin. Route chỉ là đề xuất, có thể đổi theo framework FE đang dùng, nhưng nên giữ cấu trúc nghiệp vụ tương đương.

### Nhóm xác thực

| Trang | Route đề xuất | Mục tiêu | Action chính | Quyền |
| --- | --- | --- | --- | --- |
| Đăng nhập | `/login` | Nhân viên/admin đăng nhập hệ thống | Đăng nhập | Public |
| Quên/đổi mật khẩu | `/forgot-password`, `/change-password` | Khôi phục hoặc đổi mật khẩu nếu Phase 1 cần | Gửi yêu cầu, đổi mật khẩu | User đã đăng nhập hoặc public tùy flow |
| Hồ sơ cá nhân | `/profile` | Xem thông tin tài khoản hiện tại, role, quyền | Cập nhật thông tin cá nhân | User đã đăng nhập |

### Nhóm dashboard và vận hành trong ngày

| Trang | Route đề xuất | Mục tiêu | Action chính | Quyền |
| --- | --- | --- | --- | --- |
| Dashboard | `/dashboard` | Tổng quan việc cần xử lý trong ngày | Đi tới danh sách cần xử lý | User đã đăng nhập |
| Lịch thuê | `/rental-calendar` | Xem lịch thuê theo ngày/tuần/tháng, phát hiện trùng lịch | Mở chi tiết đơn | `orders.read` |
| Việc cần xử lý | `/tasks/today` | Gom các đơn cần chuẩn bị, bàn giao, nhận trả, quá hạn | Xử lý đơn tiếp theo | `orders.read` |

Dashboard là màn hình sau đăng nhập. Không dùng dashboard như trang marketing.

### Nhóm đơn thuê

| Trang | Route đề xuất | Mục tiêu | Action chính | Quyền |
| --- | --- | --- | --- | --- |
| Danh sách đơn thuê | `/rental-orders` | Tra cứu, lọc, theo dõi tất cả đơn thuê | Tạo đơn thuê | `orders.read` |
| Tạo đơn thuê | `/rental-orders/new` | Tạo đơn thủ công theo step khách hàng, thời gian, item, tổng tiền | Lưu nháp hoặc xác nhận đơn | `orders.create` |
| Chi tiết đơn thuê | `/rental-orders/:id` | Xem toàn bộ thông tin đơn, trạng thái, thanh toán, lịch sử | Chuyển trạng thái tiếp theo | `orders.read` |
| Sửa đơn nháp | `/rental-orders/:id/edit` | Sửa đơn khi còn `DRAFT` hoặc trạng thái còn cho phép | Lưu thay đổi | `orders.update` |
| Gán thiết bị/serial | `/rental-orders/:id/assign-assets` | Gán hoặc đổi thiết bị vật lý cho từng item | Xác nhận gán thiết bị | `orders.update` |
| Bàn giao thiết bị | `/rental-orders/:id/handover` | Checklist bàn giao, ghi nhận tình trạng trước khi khách nhận | Xác nhận bàn giao | `orders.update_status` |
| Nhận trả thiết bị | `/rental-orders/:id/return` | Ghi nhận khách trả thiết bị, thời gian trả thực tế | Xác nhận nhận trả | `orders.update_status` |
| Kiểm tra sau trả | `/rental-orders/:id/inspection` | Ghi nhận tình trạng, phí trễ, hư hỏng, mất phụ kiện | Lưu kiểm tra | `orders.update` |
| Lịch sử đơn | `/rental-orders/:id/history` hoặc tab trong chi tiết | Xem status history, payment record, event log | Xem audit | `orders.read` |

Gợi ý triển khai: các trang gán thiết bị, bàn giao, nhận trả, kiểm tra có thể là route riêng hoặc modal/tab trong trang chi tiết đơn. Nếu đội FE muốn vận hành nhanh tại quầy, route riêng thường dễ làm màn hình tập trung hơn.

### Nhóm kiểm tra khả dụng

| Trang | Route đề xuất | Mục tiêu | Action chính | Quyền |
| --- | --- | --- | --- | --- |
| Tra cứu khả dụng | `/availability` | Nhập thời gian thuê để xem sản phẩm/serial nào còn khả dụng | Kiểm tra khả dụng | `orders.create` hoặc `assets.read` |
| Lịch khả dụng sản phẩm | `/products/:id/availability` | Xem lịch bị chặn của một sản phẩm | Mở đơn liên quan | `products.read` |
| Lịch khả dụng thiết bị | `/asset-units/:id/availability` | Xem lịch bị chặn của một serial | Mở đơn liên quan | `assets.read` |

Trang availability rất hữu ích cho nhân viên khi khách hỏi trước qua điện thoại/Zalo nhưng chưa tạo đơn.

### Nhóm khách hàng

| Trang | Route đề xuất | Mục tiêu | Action chính | Quyền |
| --- | --- | --- | --- | --- |
| Danh sách khách hàng | `/customers` | Tìm kiếm và quản lý khách hàng | Tạo khách hàng | `customers.read` |
| Tạo khách hàng | `/customers/new` | Tạo hồ sơ khách hàng | Lưu khách hàng | `customers.create` |
| Chi tiết khách hàng | `/customers/:id` | Xem thông tin, lịch sử thuê, công nợ, ghi chú | Tạo đơn cho khách này | `customers.read` |
| Sửa khách hàng | `/customers/:id/edit` | Cập nhật thông tin khách hàng | Lưu thay đổi | `customers.update` |

Trong trang tạo đơn cần có modal tạo nhanh khách hàng, nhưng vẫn nên có trang quản lý khách hàng đầy đủ.

### Nhóm sản phẩm

| Trang | Route đề xuất | Mục tiêu | Action chính | Quyền |
| --- | --- | --- | --- | --- |
| Danh sách sản phẩm | `/products` | Quản lý model/dòng sản phẩm cho thuê | Tạo sản phẩm | `products.read` |
| Tạo sản phẩm | `/products/new` | Tạo sản phẩm cho thuê mới | Lưu sản phẩm | `products.create` |
| Chi tiết sản phẩm | `/products/:id` | Xem thông tin, thiết bị con, lịch thuê, lịch sử đơn | Thêm thiết bị vật lý | `products.read` |
| Sửa sản phẩm | `/products/:id/edit` | Cập nhật giá, cọc, mô tả, phụ kiện, trạng thái | Lưu thay đổi | `products.update` |
| Danh mục sản phẩm | `/product-categories` | Quản lý nhóm như Camera, Lens, Light | Tạo danh mục | `products.update` hoặc quyền cấu hình riêng |
| Thương hiệu | `/brands` | Quản lý brand như Sony, Canon, DJI | Tạo thương hiệu | `products.update` hoặc quyền cấu hình riêng |

Nếu FE muốn gọn ở Phase 1, danh mục và thương hiệu có thể nằm trong phần cấu hình hoặc modal trong form sản phẩm.

### Nhóm thiết bị vật lý

| Trang | Route đề xuất | Mục tiêu | Action chính | Quyền |
| --- | --- | --- | --- | --- |
| Danh sách thiết bị | `/asset-units` | Quản lý từng thiết bị/serial | Thêm thiết bị | `assets.read` |
| Tạo thiết bị | `/asset-units/new` | Tạo serial hoặc thiết bị vật lý mới | Lưu thiết bị | `assets.create` |
| Chi tiết thiết bị | `/asset-units/:id` | Xem tình trạng, lịch thuê, damage report, lịch sử đơn | Cập nhật tình trạng | `assets.read` |
| Sửa thiết bị | `/asset-units/:id/edit` | Cập nhật serial, tình trạng, trạng thái, ghi chú | Lưu thay đổi | `assets.update` |
| Thiết bị cần chú ý | `/asset-units/attention` | Lọc thiết bị hỏng, bảo trì, mất, ngừng dùng | Cập nhật xử lý | `assets.read` |

Trang thiết bị cần chú ý có thể là một filter sẵn trên danh sách thiết bị nếu chưa muốn tách route.

### Nhóm thanh toán

| Trang | Route đề xuất | Mục tiêu | Action chính | Quyền |
| --- | --- | --- | --- | --- |
| Danh sách thanh toán | `/payments` | Xem toàn bộ payment/refund record | Mở đơn liên quan | `orders.record_payment` hoặc quyền đọc thanh toán riêng |
| Ghi nhận thanh toán | Modal trong `/rental-orders/:id` hoặc `/payments/new?orderId=...` | Ghi nhận tiền cọc, tiền thuê, phí, điều chỉnh | Lưu thanh toán | `orders.record_payment` |
| Ghi nhận hoàn tiền | Modal trong `/rental-orders/:id` | Ghi nhận tiền hoàn lại cho khách | Lưu hoàn tiền | `orders.refund` |
| Đối soát thủ công | `/payments/reconciliation` | Kiểm tra các khoản chuyển khoản/pending nếu cửa hàng cần | Xác nhận payment | Manager/Admin |

Phase 1 chỉ ghi nhận thủ công. Không xây callback tự động cho VNPay/MoMo.

### Nhóm trả hàng và xử lý sau thuê

| Trang | Route đề xuất | Mục tiêu | Action chính | Quyền |
| --- | --- | --- | --- | --- |
| Danh sách đơn chờ trả | `/returns/due` | Xem đơn đến hạn trả hôm nay hoặc sắp tới | Nhận trả thiết bị | `orders.read` |
| Danh sách đơn quá hạn | `/returns/overdue` | Theo dõi đơn quá hạn, gọi khách, ghi chú xử lý | Nhận trả hoặc chuyển tranh chấp | `orders.update_status` |
| Danh sách kiểm tra sau trả | `/returns/inspections` | Các đơn đã trả nhưng chưa tất toán kiểm tra | Kiểm tra thiết bị | `orders.read` |
| Damage reports | `/damage-reports` | Theo dõi hư hỏng/mất thiết bị, phí và trạng thái xử lý | Cập nhật xử lý | `assets.read` hoặc manager |

Các trang này giúp staff làm việc theo queue, thay vì phải tự lọc trong danh sách đơn.

### Nhóm báo cáo

| Trang | Route đề xuất | Mục tiêu | Action chính | Quyền |
| --- | --- | --- | --- | --- |
| Tổng quan báo cáo | `/reports` | Xem các chỉ số vận hành chính | Chọn báo cáo | `reports.read` |
| Báo cáo doanh thu | `/reports/revenue` | Doanh thu theo ngày/tháng, loại phí, phương thức thanh toán | Lọc/export | `reports.read` |
| Báo cáo công nợ | `/reports/debts` | Đơn còn phải thu, còn cọc phải hoàn | Mở đơn xử lý | `reports.read` |
| Báo cáo sản phẩm | `/reports/products` | Sản phẩm được thuê nhiều, doanh thu theo sản phẩm | Lọc/export | `reports.read` |
| Báo cáo thiết bị | `/reports/assets` | Thiết bị đang thuê, bảo trì, hư hỏng, mất | Lọc/export | `reports.read` |

Export CSV/XLSX có thể để Phase 1.1 nếu chưa cần ngay.

### Nhóm người dùng và phân quyền

| Trang | Route đề xuất | Mục tiêu | Action chính | Quyền |
| --- | --- | --- | --- | --- |
| Danh sách người dùng | `/users` | Quản lý tài khoản admin/staff | Tạo người dùng | `users.read` |
| Tạo người dùng | `/users/new` | Tạo tài khoản nội bộ | Lưu người dùng | `users.create` |
| Chi tiết người dùng | `/users/:id` | Xem thông tin, role, trạng thái, lịch sử liên quan | Sửa người dùng | `users.read` |
| Sửa người dùng | `/users/:id/edit` | Cập nhật profile, active, role | Lưu thay đổi | `users.update` |
| Danh sách vai trò | `/roles` | Quản lý role | Tạo vai trò | `roles.read` |
| Tạo/sửa vai trò | `/roles/new`, `/roles/:id/edit` | Cấu hình permission cho role | Lưu vai trò | `roles.create` / `roles.update` |
| Danh sách quyền | `/permissions` | Xem permission seed trong hệ thống | Xem quyền | `roles.read` |

Permission thường được seed sẵn từ backend, UI không nhất thiết cho tạo permission mới nếu hệ thống chưa hỗ trợ.

### Nhóm cấu hình

| Trang | Route đề xuất | Mục tiêu | Action chính | Quyền |
| --- | --- | --- | --- | --- |
| Cấu hình chung | `/settings` | Thông tin cửa hàng, timezone, format tiền tệ nếu cần | Lưu cấu hình | Admin/Manager |
| Cấu hình phí thuê | `/settings/rental-pricing` | Quy tắc ngày thuê, phí trễ, làm tròn thời gian nếu Phase 1 cần | Lưu cấu hình | Admin/Manager |
| Cấu hình mẫu in | `/settings/print-templates` | Mẫu phiếu thuê, phiếu bàn giao, biên nhận nếu cần | Lưu mẫu | Admin/Manager |

Nếu backend chưa có model cấu hình, các trang này có thể để sau. Trong Phase 1 tối thiểu chỉ cần cấu hình bằng env hoặc hard-code nghiệp vụ đơn giản.

### Trang ưu tiên MVP

Nếu cần chia MVP trước, nên xây theo thứ tự:

1. `/login`
2. `/dashboard`
3. `/customers`, `/customers/new`, `/customers/:id`
4. `/products`, `/products/new`, `/products/:id`
5. `/asset-units`, `/asset-units/new`, `/asset-units/:id`
6. `/availability`
7. `/rental-orders`, `/rental-orders/new`, `/rental-orders/:id`
8. Các màn hình thao tác trong đơn: gán thiết bị, thanh toán, bàn giao, nhận trả, kiểm tra
9. `/returns/due`, `/returns/overdue`, `/returns/inspections`
10. `/users`, `/roles`
11. `/reports`
12. `/settings`

## 4. Quy tắc giao diện chung

### Trạng thái

Mọi badge trạng thái cần thống nhất màu và nhãn tiếng Việt.

Order status:

| Code | Nhãn | Ý nghĩa UI |
| --- | --- | --- |
| `DRAFT` | Nháp | Đơn chưa xác nhận, chưa khóa lịch thiết bị |
| `CONFIRMED` | Đã xác nhận | Đơn đã chốt lịch, bắt đầu chặn khả dụng |
| `PREPARING` | Đang chuẩn bị | Kho/nhân viên đang chuẩn bị thiết bị |
| `READY_FOR_PICKUP` | Sẵn sàng nhận | Thiết bị sẵn sàng cho khách nhận tại cửa hàng |
| `DELIVERING` | Đang giao | Thiết bị đang được giao cho khách |
| `RENTING` | Đang thuê | Khách đang giữ thiết bị |
| `OVERDUE` | Quá hạn | Quá thời gian trả dự kiến |
| `RETURNED` | Đã trả | Khách đã trả, đang/đã chờ kiểm tra |
| `COMPLETED` | Hoàn tất | Đã tất toán và đóng đơn |
| `CANCELLED` | Đã hủy | Đơn bị hủy |
| `REFUNDING` | Đang hoàn tiền | Đang xử lý khoản hoàn |
| `REFUNDED` | Đã hoàn tiền | Đã hoàn tiền xong |
| `DISPUTED` | Tranh chấp | Có vấn đề cần xử lý thủ công |

Payment status:

| Code | Nhãn |
| --- | --- |
| `UNPAID` | Chưa thanh toán |
| `PARTIALLY_PAID` | Thanh toán một phần |
| `PAID` | Đã thanh toán |
| `PARTIALLY_REFUNDED` | Hoàn một phần |
| `REFUNDED` | Đã hoàn tiền |

### Hành động chính

Mỗi màn hình chỉ nên có một primary action rõ nhất:

- Danh sách đơn: `Tạo đơn thuê`
- Chi tiết đơn nháp: `Xác nhận đơn`
- Đơn đã xác nhận: `Bắt đầu chuẩn bị`
- Đơn đang chuẩn bị: `Đánh dấu sẵn sàng` hoặc `Chuyển sang giao hàng`
- Đơn sẵn sàng/giao hàng: `Bàn giao cho khách`
- Đơn đang thuê: `Nhận trả thiết bị`
- Đơn đã trả: `Kiểm tra và tất toán`

Các hành động phụ như ghi chú, in phiếu, ghi nhận thanh toán, hủy đơn, chuyển tranh chấp nên đặt ở menu phụ hoặc cụm secondary actions.

### Tìm kiếm và bộ lọc

Các màn hình danh sách nên có:

- Ô tìm kiếm keyword.
- Bộ lọc trạng thái.
- Bộ lọc ngày tạo.
- Bộ lọc thời gian thuê.
- Bộ lọc nhân viên phụ trách.
- Bộ lọc thanh toán.
- Sắp xếp theo ngày tạo, ngày thuê, ngày trả, tổng tiền.

Keyword nên tìm theo mã đơn, tên khách, số điện thoại, SKU, serial nếu màn hình liên quan.

### Empty state

Không dùng empty state chỉ để trang trí. Mỗi empty state cần có hành động tiếp theo:

- Chưa có đơn thuê: hiển thị nút `Tạo đơn thuê`.
- Không có kết quả lọc: hiển thị `Xóa bộ lọc`.
- Chưa có thiết bị trong sản phẩm: hiển thị `Thêm thiết bị vật lý`.

### Loading và lỗi

- Loading bảng: skeleton rows hoặc spinner nhỏ trong vùng bảng.
- Loading form submit: disable nút submit và hiển thị trạng thái đang lưu.
- Lỗi validation: hiển thị ngay dưới field.
- Lỗi nghiệp vụ: dùng alert/toast có nội dung rõ, ví dụ `Thiết bị SN001 đã được đặt trong khoảng thời gian này`.

## 4.1. Page flow, dialog và modal

Phần này mô tả cách chia màn hình lớn, modal, drawer và confirm dialog để UI vận hành nhanh nhưng không bị rối.

### Nguyên tắc chọn page, modal, drawer

| Loại UI | Dùng khi | Không dùng khi |
| --- | --- | --- |
| Page riêng | Flow dài, nhiều bước, cần URL/share/back browser | Chỉ nhập 1-3 field đơn giản |
| Drawer bên phải | Xem/sửa nhanh một record trong khi vẫn giữ ngữ cảnh danh sách | Form quá dài hoặc có nhiều tab |
| Modal form | Tạo nhanh record phụ, ví dụ tạo customer trong lúc tạo order | Flow có nhiều bước hoặc cần xem nhiều dữ liệu |
| Confirm dialog | Hành động nguy hiểm/không dễ undo: hủy, xóa mềm, chuyển trạng thái quan trọng | Hành động thường xuyên, ít rủi ro |
| Full-screen workflow | Tạo đơn thuê, bàn giao, nhận trả/kiểm tra | Chỉ cập nhật một field |

Quy tắc chung:

- List page là nơi scan, filter, sort và mở detail.
- Detail page là nơi xử lý nghiệp vụ chính của record.
- Modal chỉ nên giải quyết một việc rõ ràng.
- Không đặt form dài nhiều section trong modal nhỏ.
- Không dùng confirm dialog cho mọi hành động; chỉ dùng khi cần xác nhận thật sự.
- Sau khi submit modal thành công, đóng modal và refresh vùng dữ liệu liên quan, không reload toàn trang nếu không cần.

### Layout chuẩn cho list page

List page nên có cấu trúc:

```txt
Header
  Title + primary action

Filter bar
  Search
  Status filters
  Date range
  Owner/assignee filter nếu có

Table
  Important columns
  Row actions

Pagination
```

Row action nên gồm:

- Xem chi tiết.
- Sửa nếu còn được phép.
- Action phụ trong menu `...`.

Không đưa quá nhiều nút ra từng row, vì bảng vận hành sẽ khó scan.

### Layout chuẩn cho detail page

Detail page nên có cấu trúc:

```txt
Header
  Code/name
  Status badge
  Primary next action
  Secondary action menu

Summary band
  Key facts and money totals

Tabs/sections
  Overview
  Items/assets
  Payments
  Handover
  Return/inspection
  History/events
```

Các tab dữ liệu nặng như payment/history/event nên load theo tab hoặc endpoint riêng, không cần trả hết trong response detail ban đầu.

### Confirm dialog chuẩn

Confirm dialog nên có:

- Tiêu đề nêu hành động thật, ví dụ `Hủy đơn thuê ORD-000123`.
- Nội dung ngắn nêu hậu quả.
- Field lý do nếu nghiệp vụ cần audit.
- Nút chính dùng màu nguy hiểm khi hủy/xóa.
- Nút phụ `Đóng` hoặc `Quay lại`.

Ví dụ:

```txt
Title: Hủy đơn thuê ORD-000123
Body: Đơn đã xác nhận sẽ không còn giữ lịch thiết bị sau khi hủy.
Field: Lý do hủy
Actions: Quay lại / Hủy đơn
```

### Form modal/drawer chuẩn

Form modal/drawer nên có:

- Title rõ nghiệp vụ.
- Field theo thứ tự nhân viên nghĩ khi thao tác.
- Validation inline dưới field.
- Nút `Lưu` cố định ở footer.
- Loading state khi submit.
- Toast thành công sau khi lưu.

Nếu form có hơn 8-10 field hoặc cần nhiều bảng phụ, dùng page riêng thay vì modal.

### Flow Customers

Trang:

```txt
/customers
/customers/:id
```

Modal/drawer nên có:

- `Create customer` modal từ list hoặc từ màn tạo order.
- `Edit customer` drawer trong detail.
- `Update status` confirm dialog nếu chuyển sang `BLOCKED`.
- `Delete customer` confirm dialog.

Flow tạo nhanh customer trong order:

```txt
Create rental order
-> Click "Tạo khách mới"
-> Modal create customer
-> Save
-> Modal close
-> Newly created customer selected in order form
```

### Flow Products và AssetUnits

Trang:

```txt
/products
/products/:id
/asset-units
/asset-units/:id
```

Product nên dùng page/detail vì có giá, cọc, mô tả, accessories, tiers.

AssetUnit có thể dùng modal hoặc drawer khi tạo từ product detail:

```txt
Product detail
-> Tab AssetUnits
-> Add AssetUnit modal
-> Save
-> Refresh asset unit table
```

Quy tắc inventory:

- Product không có `stockQuantity`.
- Product detail phải hiển thị số AssetUnit active/usable.
- Nếu Product chưa có AssetUnit usable, hiển thị cảnh báo `Sản phẩm chưa thể cho thuê`.
- Tạo order chỉ cho chọn product có AssetUnit usable.

### Flow Rental Orders

Trang:

```txt
/rental-orders
/rental-orders/new
/rental-orders/:id
/rental-orders/:id/edit
```

Tạo order nên là page riêng dạng stepper:

```txt
Step 1: Chọn khách hàng
Step 2: Chọn thời gian thuê
Step 3: Chọn sản phẩm/thiết bị
Step 4: Kiểm tra khả dụng
Step 5: Tổng tiền và lưu nháp/xác nhận
```

Dialog/modal trong order:

- Create customer modal.
- Check availability result modal hoặc inline panel.
- Assign asset modal/drawer.
- Cancel order confirm dialog có field `cancelReason`.
- Confirm order dialog nếu order sẽ bắt đầu block lịch.
- Delete draft confirm dialog.

Primary action theo trạng thái:

| Status | Primary action | UI nên dùng |
| --- | --- | --- |
| `DRAFT` | Xác nhận đơn | Confirm dialog |
| `CONFIRMED` | Bắt đầu chuẩn bị | Button/action |
| `PREPARING` | Sẵn sàng nhận hoặc giao hàng | Button/action |
| `READY_FOR_PICKUP` | Bàn giao | Full-screen workflow hoặc drawer |
| `DELIVERING` | Xác nhận đã giao | Confirm dialog ngắn |
| `RENTING` | Nhận trả | Full-screen workflow |
| `RETURNED` | Kiểm tra sau trả | Full-screen workflow |
| `DISPUTED` | Xử lý tranh chấp | Page/detail section |

### Flow assign asset

Assign asset nên dùng drawer hoặc full-screen nếu nhiều item:

```txt
Open assign asset
-> Show order items
-> For each quantity = 1 item, choose available AssetUnit
-> Validate asset belongs to product
-> Validate no overlap
-> Save
```

UI cần hiển thị:

- Product name/SKU snapshot.
- Serial đang gán nếu có.
- Danh sách serial khả dụng.
- Cảnh báo serial bị block trong thời gian thuê.

Nếu item quantity > 1, UI nên yêu cầu tách/gán từng serial hoặc chỉ cho product-level booking cho tới bước chuẩn bị.

### Flow Payments

Payment nên là modal trong order detail:

```txt
Order detail
-> Click "Ghi nhận thanh toán"
-> Payment modal
-> Save PaymentRecord
-> Refresh payment tab and money totals
```

Payment modal fields:

- Kind: `HOLD_FEE`, `RENTAL_FEE`, `DEPOSIT`, `DELIVERY_FEE`, `LATE_FEE`, `DAMAGE_FEE`, `ADJUSTMENT`.
- Method: cash/bank/card/e-wallet/other.
- Amount.
- Reference code.
- Note.

Refund nên là modal riêng:

```txt
Order detail
-> Click "Ghi nhận hoàn tiền"
-> Refund modal
-> Save PaymentRecord kind REFUND
-> Refresh refund/payment status
```

Không trộn payment thu tiền và refund vào cùng modal nếu làm UI khó hiểu.

### Flow Handover

Bàn giao nên là workflow tập trung, có thể là page hoặc large drawer:

```txt
Open handover
-> Review customer and order info
-> Review assigned asset units
-> Checklist accessories/condition
-> Record OUTBOUND handover
-> Move order to RENTING
```

Nên có confirm cuối nếu order chưa thanh toán đủ phần cần thu trước bàn giao.

Handover UI cần:

- Danh sách asset unit/serial.
- Condition note.
- Accessories note.
- Staff handling.
- Actual handover time.

### Flow Return / Inspection

Nhận trả và kiểm tra nên tách 2 bước:

```txt
Return handover
-> Mark order RETURNED
-> Return inspection
-> Calculate fees/refund
-> Complete or dispute
```

Return handover fields:

- Actual return date.
- Asset units returned.
- Quick condition note.
- Missing obvious accessories if any.

Inspection fields:

- Result: OK/DAMAGED/MISSING_ITEMS/DISPUTED.
- Late fee.
- Damage fee.
- Missing fee.
- Condition summary.
- Damage reports list.

Damage report nên là sub-modal hoặc inline editable row trong inspection:

```txt
Add damage report
-> Select product/asset unit
-> Severity
-> Description
-> Estimated fee
-> Save row
```

### Flow History / Events

History nên là tab trong order detail, không phải modal.

Nên tách:

- Status history: timeline trạng thái.
- Events: audit log tổng quát.
- Payments: bảng thanh toán.
- Handovers: bảng bàn giao/nhận trả.
- Inspections: bảng kiểm tra sau trả.

Mặc định detail chỉ cần load overview + items. Các tab còn lại load khi user mở tab.

### Flow Users / Roles / Permissions

Quản lý phân quyền nên dùng page riêng, không dùng modal nhỏ vì cần xem nhiều dữ liệu.

Trang:

```txt
/users
/users/:id
/roles
/roles/:id
/permissions
```

User flow:

```txt
Users list
-> Create user page or drawer
-> Assign role(s)
-> Save
-> User detail shows roles and derived permissions
```

Role flow:

```txt
Roles list
-> Role detail/edit page
-> Edit name/description
-> Select permissions by module group
-> Save role permissions
```

Dialog/modal nên có:

- `Change user activity status` confirm dialog nếu chuyển sang banned/locked/inactive.
- `Assign roles` drawer hoặc section trong user detail.
- `Delete user` confirm dialog, không cho tự xóa tài khoản hiện tại.
- `Create role` page hoặc large drawer.
- `Edit role permissions` page/detail, không dùng modal nhỏ.
- `Delete role` confirm dialog, không cho xóa system role.

Quy tắc UI:

- Không hardcode role enum để quyết định quyền hiển thị nút.
- FE nên dùng permission codes backend trả về sau login.
- Role chỉ là nhóm quyền; user có thể có nhiều role.
- Permission thường là dữ liệu seed từ backend, UI chủ yếu xem/chọn, không nhất thiết tạo permission mới.
- System role nên hiển thị badge `System` và disable delete.
- Khi sửa quyền role, cần cảnh báo thay đổi sẽ ảnh hưởng tất cả user đang dùng role đó.

## 5. Dashboard

Dashboard là màn hình vận hành trong ngày, không phải landing page.

### Mục tiêu

Giúp admin/staff biết ngay hôm nay cần làm gì:

- Đơn cần chuẩn bị.
- Đơn chờ bàn giao.
- Đơn đang thuê.
- Đơn đến hạn trả hôm nay.
- Đơn quá hạn.
- Thanh toán còn thiếu.
- Thiết bị đang bảo trì/hỏng/mất.

### Thành phần UI

Khu vực trên cùng:

- Card `Đơn thuê hôm nay`
- Card `Cần bàn giao`
- Card `Đến hạn trả`
- Card `Quá hạn`
- Card `Còn phải thu`

Bên dưới:

- Bảng `Việc cần xử lý hôm nay`
- Lịch thuê dạng timeline/calendar
- Danh sách `Đơn quá hạn`
- Danh sách `Thiết bị cần chú ý`

### Hành vi

- Click card chuyển sang danh sách đơn với filter tương ứng.
- Timeline hiển thị mã đơn, khách hàng, trạng thái, thời gian bắt đầu/kết thúc.
- Đơn quá hạn cần nổi bật hơn đơn bình thường.

## 6. Quản lý khách hàng

### Danh sách khách hàng

Cột đề xuất:

- Mã khách hàng
- Họ tên
- Số điện thoại
- Email
- Trạng thái
- Số đơn đã thuê
- Lần thuê gần nhất
- Ghi chú ngắn
- Hành động

Bộ lọc:

- Trạng thái: active, inactive, blocked.
- Có số điện thoại/email.
- Có đơn thuê.

Hành động:

- Xem chi tiết.
- Sửa.
- Tạo đơn thuê cho khách này.
- Chặn/mở chặn nếu có quyền.

### Form khách hàng

Field chính:

- Họ tên: bắt buộc.
- Số điện thoại: nên bắt buộc trong vận hành thực tế.
- Email: tùy chọn.
- Địa chỉ: tùy chọn.
- CCCD/hộ chiếu: tùy chọn nhưng quan trọng với đơn có cọc.
- Liên hệ mạng xã hội/Zalo/Facebook: tùy chọn.
- Ghi chú nội bộ.
- Trạng thái.

### Chi tiết khách hàng

Tab đề xuất:

- Tổng quan
- Lịch sử đơn thuê
- Thanh toán liên quan
- Ghi chú

Tổng quan nên hiển thị:

- Thông tin liên hệ.
- Trạng thái khách.
- Số đơn đã hoàn tất.
- Số đơn bị hủy/tranh chấp.
- Số tiền còn nợ nếu có.

## 7. Quản lý sản phẩm

`Product` là model/dòng sản phẩm cho thuê, ví dụ Sony A7 IV hoặc Lens 24-70.

### Danh sách sản phẩm

Cột đề xuất:

- Ảnh/thumbnail nếu FE có hỗ trợ media sau này.
- Tên sản phẩm.
- SKU.
- Danh mục.
- Thương hiệu.
- Giá thuê ngày.
- Giá nửa ngày.
- Tiền cọc.
- Số AssetUnit active/usable.
- Số AssetUnit đang được thuê/đang block lịch.
- Trạng thái.
- Hành động.

Bộ lọc:

- Danh mục.
- Thương hiệu.
- Đang hoạt động/ngừng hoạt động.
- Có AssetUnit usable/chưa có AssetUnit.

### Form sản phẩm

Field bắt buộc:

- Tên sản phẩm.
- SKU.
- Giá thuê ngày.
- Tiền cọc.

Field tùy chọn:

- Danh mục.
- Thương hiệu.
- Mô tả.
- Phụ kiện đi kèm.
- Hướng dẫn sử dụng/bàn giao.
- Giá nửa ngày.
- Giá quá giờ.
- Giá trị thay thế.
- Trạng thái hoạt động.

Sau khi tạo Product, admin cần tạo `AssetUnit` cho từng thiết bị vật lý. Product không có `AssetUnit` usable thì chưa thể cho thuê.

### Chi tiết sản phẩm

Tab đề xuất:

- Thông tin
- Thiết bị vật lý
- Lịch thuê
- Lịch sử đơn

Phần lịch thuê cần hiển thị các đơn đang chặn khả dụng theo thời gian.

## 8. Quản lý thiết bị vật lý

`AssetUnit` là từng thiết bị cụ thể, thường có serial.

### Danh sách thiết bị

Cột đề xuất:

- Serial.
- Sản phẩm.
- Trạng thái vận hành.
- Tình trạng.
- Đang nằm trong đơn nào.
- Lịch thuê kế tiếp.
- Ghi chú.
- Hành động.

Asset status:

| Code | Nhãn | Ý nghĩa |
| --- | --- | --- |
| `AVAILABLE` | Có thể cho thuê | Có thể gán vào đơn nếu không trùng lịch |
| `RESERVED` | Đã giữ lịch | Có đơn tương lai đang chặn |
| `RENTED` | Đang cho thuê | Khách đang giữ thiết bị |
| `MAINTENANCE` | Bảo trì | Không được gán vào đơn mới |
| `RETIRED` | Ngừng dùng | Không cho thuê nữa |
| `LOST` | Mất | Không cho thuê nữa |

Asset condition:

| Code | Nhãn |
| --- | --- |
| `NEW` | Mới |
| `GOOD` | Tốt |
| `FAIR` | Trung bình |
| `DAMAGED` | Hư hỏng |
| `LOST` | Mất |

### Form thiết bị

Field:

- Sản phẩm: bắt buộc.
- Serial: nên bắt buộc nếu cửa hàng quản lý serial.
- Trạng thái.
- Tình trạng.
- Ghi chú.
- Active/inactive.

### Quy tắc UI quan trọng

Không chỉ nhìn `AssetStatus` để quyết định khả dụng. Khi gán thiết bị vào đơn, UI phải gọi API kiểm tra overlap theo thời gian thuê:

```txt
existing.startDate < new.endDate
AND existing.endDate > new.startDate
```

Các trạng thái đơn chặn lịch:

```txt
CONFIRMED
PREPARING
READY_FOR_PICKUP
DELIVERING
RENTING
OVERDUE
```

## 9. Quản lý đơn thuê

Đây là module trung tâm của hệ thống.

### Danh sách đơn thuê

Cột đề xuất:

- Mã đơn.
- Khách hàng.
- Số điện thoại.
- Thời gian thuê.
- Trạng thái đơn.
- Trạng thái thanh toán.
- Tổng tiền thuê.
- Tiền cọc.
- Đã thu.
- Còn lại/hoàn.
- Nhân viên phụ trách.
- Ngày tạo.
- Hành động.

Bộ lọc:

- Trạng thái đơn.
- Trạng thái thanh toán.
- Khoảng ngày thuê.
- Khoảng ngày tạo.
- Nhân viên phụ trách.
- Phương thức nhận hàng.
- Đơn quá hạn.
- Đơn còn nợ.

Hành động nhanh:

- Xem chi tiết.
- Ghi nhận thanh toán.
- Chuyển trạng thái tiếp theo.
- Hủy đơn nếu trạng thái cho phép.

### Tạo đơn thuê

Nên thiết kế dạng stepper hoặc form chia section rõ ràng.

#### Bước 1: Chọn khách hàng

Chức năng:

- Tìm khách theo tên/số điện thoại/email.
- Chọn khách đã có.
- Tạo nhanh khách mới nếu chưa có.
- Cảnh báo nếu khách bị `BLOCKED`.

Khi chọn khách, hệ thống lưu snapshot vào đơn:

- Tên khách.
- Số điện thoại.
- Email.
- Địa chỉ.
- Số giấy tờ nếu có.

Không dùng dữ liệu khách hiện tại để tính lại lịch sử đơn cũ.

#### Bước 2: Chọn thời gian thuê

Field:

- Ngày giờ bắt đầu.
- Ngày giờ kết thúc.
- Phương thức nhận: nhận tại cửa hàng hoặc giao hàng.
- Địa chỉ giao nếu chọn giao hàng.
- Phí giao hàng nếu có.

Validation:

- `endDate` phải sau `startDate`.
- Không cho tạo khoảng thuê quá ngắn hoặc quá dài nếu cửa hàng có cấu hình.
- Khi đổi thời gian, phải kiểm tra lại khả dụng các item đã chọn.

#### Bước 3: Chọn sản phẩm/thiết bị

UI cần hỗ trợ hai cách vận hành:

1. Quản lý theo số lượng sản phẩm.
2. Quản lý theo từng thiết bị vật lý/serial.

Với sản phẩm:

- Tìm theo tên, SKU, danh mục, thương hiệu.
- Hiển thị giá thuê ngày, tiền cọc, số lượng khả dụng trong khoảng thời gian đã chọn.
- Cho nhập số lượng.
- Cảnh báo nếu số lượng vượt khả dụng.

Với thiết bị vật lý:

- Cho chọn serial cụ thể.
- Chỉ hiển thị thiết bị active, không bảo trì, không ngừng dùng, không mất.
- Vẫn phải kiểm tra overlap thời gian trước khi xác nhận.

Mỗi dòng đơn cần lưu:

- `productId`
- `assetUnitId` nếu có.
- Số lượng.
- Snapshot tên sản phẩm.
- Snapshot SKU.
- Đơn giá thuê.
- Tiền cọc.
- Thành tiền.
- Ghi chú item.

#### Bước 4: Tổng tiền và ghi chú

Hiển thị bảng tổng kết:

- Tạm tính tiền thuê.
- Tổng tiền cọc.
- Phí giao hàng.
- Giảm giá thủ công.
- Tổng cần thu.
- Đã thu.
- Còn lại.
- Dự kiến hoàn cọc sau khi trả.

Field:

- Ghi chú cho khách.
- Ghi chú nội bộ.
- Nhân viên phụ trách.

#### Bước 5: Lưu nháp hoặc xác nhận

Nút hành động:

- `Lưu nháp`: tạo đơn `DRAFT`, chưa chặn lịch.
- `Xác nhận đơn`: tạo/chuyển đơn `CONFIRMED`, bắt đầu chặn lịch.

Trước khi xác nhận cần kiểm tra lại availability để tránh race condition.

### Chi tiết đơn thuê

Layout đề xuất:

- Header: mã đơn, trạng thái đơn, trạng thái thanh toán, hành động chính.
- Cột trái/main: thông tin khách, thời gian thuê, item thuê, thanh toán.
- Cột phải/sidebar: timeline trạng thái, audit events, ghi chú.

Tab đề xuất:

- Tổng quan
- Thiết bị và bàn giao
- Thanh toán
- Trả hàng và kiểm tra
- Lịch sử

Thông tin cần hiển thị rõ:

- Snapshot khách hàng tại thời điểm tạo đơn.
- Danh sách item với snapshot giá.
- Thiết bị/serial được gán.
- Tổng tiền và công nợ.
- Người tạo, người phụ trách.
- Lịch sử chuyển trạng thái.

## 10. Luồng trạng thái đơn thuê

Luồng chính:

```txt
DRAFT
-> CONFIRMED
-> PREPARING
-> READY_FOR_PICKUP / DELIVERING
-> RENTING
-> RETURNED
-> COMPLETED
```

Luồng phụ:

```txt
OVERDUE
CANCELLED
REFUNDING
REFUNDED
DISPUTED
```

### Ma trận hành động theo trạng thái

| Trạng thái hiện tại | Hành động chính | Trạng thái tiếp theo |
| --- | --- | --- |
| `DRAFT` | Xác nhận đơn | `CONFIRMED` |
| `CONFIRMED` | Bắt đầu chuẩn bị | `PREPARING` |
| `PREPARING` | Sẵn sàng nhận tại cửa hàng | `READY_FOR_PICKUP` |
| `PREPARING` | Bắt đầu giao hàng | `DELIVERING` |
| `READY_FOR_PICKUP` | Bàn giao cho khách | `RENTING` |
| `DELIVERING` | Xác nhận đã giao | `RENTING` |
| `RENTING` | Nhận trả thiết bị | `RETURNED` |
| `RETURNED` | Tất toán đơn | `COMPLETED` |
| `RENTING` | Đánh dấu quá hạn | `OVERDUE` |
| `OVERDUE` | Nhận trả thiết bị | `RETURNED` |
| Bất kỳ trạng thái mở | Chuyển tranh chấp | `DISPUTED` |
| Trạng thái trước khi thuê | Hủy đơn | `CANCELLED` |
| Cần hoàn tiền | Bắt đầu hoàn tiền | `REFUNDING` |
| `REFUNDING` | Hoàn tiền xong | `REFUNDED` |

### Quy tắc chuyển trạng thái

- Mọi lần đổi trạng thái phải tạo `OrderStatusHistory`.
- Cần nhập ghi chú/lý do khi hủy, tranh chấp, hoàn tiền, chỉnh trạng thái ngược.
- Khi chuyển sang `CONFIRMED`, phải kiểm tra availability.
- Khi chuyển sang `RENTING`, nên tạo bản ghi bàn giao `OrderHandover` loại `OUTBOUND`.
- Khi chuyển sang `RETURNED`, nên tạo bản ghi bàn giao trả `OrderHandover` loại `RETURN`.
- Khi chuyển sang `COMPLETED`, đơn phải được kiểm tra và không còn công nợ bất thường, trừ khi manager/admin xác nhận bỏ qua.

## 11. Bàn giao thiết bị

### Màn hình chuẩn bị/bàn giao

Nên có màn hình riêng hoặc tab trong chi tiết đơn.

Thông tin:

- Danh sách sản phẩm cần chuẩn bị.
- Serial đã gán.
- Phụ kiện đi kèm theo snapshot/product.
- Ghi chú tình trạng trước khi giao.
- Người xử lý.
- Thời gian bàn giao.

Checklist mỗi item:

- Đủ thiết bị chính.
- Đủ phụ kiện.
- Kiểm tra pin/thẻ nhớ/dây sạc nếu áp dụng.
- Tình trạng hoạt động.
- Ghi chú thêm.

Hành động:

- Gán serial nếu chưa gán.
- Đổi serial nếu thiết bị không khả dụng.
- Xác nhận chuẩn bị xong.
- Xác nhận bàn giao.

### UI khi gán serial

Danh sách serial phải hiển thị:

- Serial.
- Tình trạng.
- Trạng thái.
- Lịch bị chặn trong khoảng thuê.
- Cảnh báo nếu không thể gán.

Nếu không có serial khả dụng, hiển thị lý do:

- Hết số lượng.
- Đang được thuê trùng thời gian.
- Đang bảo trì.
- Đã mất/ngừng dùng.

## 12. Thanh toán thủ công

`PaymentRecord` là bản ghi thu/chi tiền thủ công. Không tự xác nhận từ cổng online trong Phase 1.

### Danh sách thanh toán

Cột đề xuất:

- Thời gian ghi nhận.
- Mã đơn.
- Khách hàng.
- Loại tiền.
- Phương thức.
- Số tiền.
- Trạng thái.
- Người ghi nhận.
- Mã tham chiếu.
- Ghi chú.

Bộ lọc:

- Loại tiền.
- Phương thức.
- Trạng thái.
- Khoảng thời gian.
- Người ghi nhận.

### Ghi nhận thanh toán trong đơn

Form:

- Loại: `HOLD_FEE`, `DEPOSIT`, `RENTAL_FEE`, `LATE_FEE`, `DAMAGE_FEE`, `DELIVERY_FEE`, `REFUND`, `ADJUSTMENT`.
- Phương thức: tiền mặt, chuyển khoản, thẻ, ví điện tử, khác.
- Số tiền.
- Trạng thái: mặc định `SUCCESS`; có thể dùng `PENDING` nếu cần chờ xác nhận.
- Mã tham chiếu.
- Ghi chú.

Validation:

- Số tiền phải lớn hơn 0.
- `REFUND` vẫn nhập số dương, hệ thống hiểu là tiền chi ra theo `kind`.
- Không cho staff ghi nhận hoàn tiền nếu không có quyền `orders.refund`.
- Khi ghi nhận thanh toán thành công, cập nhật lại `paidTotal`, `remainingTotal`, `refundTotal`, `paymentStatus`.

### Công thức hiển thị tiền

Các số liệu nên được FE hiển thị nhất quán từ backend:

```txt
grossDue = subtotal + depositTotal + deliveryFeeTotal + lateFeeTotal + damageFeeTotal - discountTotal
paidTotal = tổng PaymentRecord SUCCESS không phải REFUND
refundedPaid = tổng PaymentRecord SUCCESS có kind REFUND
remainingTotal = max(grossDue - paidTotal, 0)
refundTotal = số tiền cần hoàn sau khi xét cọc, phí phát sinh và tiền đã hoàn
```

Backend nên là nguồn tính toán chính. FE chỉ format và cảnh báo.

## 13. Nhận trả và kiểm tra thiết bị

### Nhận trả

Khi khách trả thiết bị:

- Staff mở đơn `RENTING` hoặc `OVERDUE`.
- Bấm `Nhận trả thiết bị`.
- Nhập thời gian trả thực tế.
- Xác nhận danh sách thiết bị đã nhận.
- Ghi chú tình trạng ban đầu.
- Hệ thống chuyển đơn sang `RETURNED`.

Nếu trả muộn:

- UI hiển thị số giờ/ngày trễ.
- Gợi ý phí trễ nếu backend có cấu hình.
- Staff/manager có thể nhập phí trễ thủ công.

### Kiểm tra sau trả

Form `ReturnInspection`:

- Kết quả: pending, ok, damaged, missing items, disputed.
- Tóm tắt tình trạng.
- Phí trễ.
- Phí hư hỏng.
- Phí mất phụ kiện.
- Ghi chú.
- Người kiểm tra.
- Thời gian kiểm tra.

Nếu có hư hỏng/mất:

- Thêm `DamageReport`.
- Chọn sản phẩm.
- Chọn serial nếu có.
- Mức độ: low, medium, high, lost.
- Mô tả.
- Phí dự kiến.
- Đánh dấu đã xử lý/chưa xử lý.

### Sau kiểm tra

UI cần cập nhật:

- `lateFeeTotal`
- `damageFeeTotal`
- `remainingTotal`
- `refundTotal`
- Trạng thái thiết bị nếu hư hỏng/mất/bảo trì.

Nếu còn tiền phải thu:

- Hiển thị CTA `Ghi nhận thu thêm`.

Nếu cần hoàn tiền:

- Hiển thị CTA `Ghi nhận hoàn tiền`.

Nếu không còn vấn đề:

- Hiển thị CTA `Hoàn tất đơn`.

## 14. Khả dụng thiết bị

Khả dụng là phần nghiệp vụ quan trọng nhất của hệ thống thuê.

### Nguyên tắc

Một sản phẩm/thiết bị được xem là không khả dụng nếu có đơn khác ở trạng thái chặn lịch và thời gian thuê bị overlap.

Trạng thái chặn:

```txt
CONFIRMED
PREPARING
READY_FOR_PICKUP
DELIVERING
RENTING
OVERDUE
```

Điều kiện overlap:

```txt
existing.startDate < new.endDate
AND existing.endDate > new.startDate
```

### Với serial cụ thể

Không cho cùng một `assetUnitId` xuất hiện trong hai đơn overlap thuộc trạng thái chặn.

UI cần hiển thị lỗi cụ thể:

```txt
Thiết bị Sony A7 IV - SN001 đã được đặt trong đơn RO-00012 từ 08:00 10/06/2026 đến 18:00 12/06/2026.
```

### Với số lượng sản phẩm

Nếu không gán serial:

- Tính tổng quantity của các item cùng `productId` trong đơn overlap.
- So sánh với số `AssetUnit` active/usable có thể cho thuê; không dùng fallback `Product.stockQuantity`.
- Nếu vượt, không cho xác nhận đơn.

UI nên hiển thị:

- Tổng số lượng.
- Đã bị giữ trong khoảng này.
- Còn khả dụng.
- Số lượng người dùng đang chọn.

## 14.1. Luồng nghiệp vụ cần giữ nhất quán

Phần này là checklist nghiệp vụ để backend/frontend không triển khai lệch giữa các module.

### Product -> AssetUnit inventory flow

`Product` chỉ là model/dòng sản phẩm cho thuê. `AssetUnit` mới là tồn kho vật lý thật.

```txt
Create Product
-> Create AssetUnit(s) for Product
-> Product can be selected in rental order only when it has usable AssetUnit(s)
-> Availability is calculated from AssetUnit(s)
```

Quy tắc:

- Không dùng fallback `Product.stockQuantity`.
- Không thêm lại field tồn kho trên `Product`.
- Product có thể tồn tại như catalog trước khi nhập thiết bị, nhưng chưa thể cho thuê nếu chưa có asset unit usable.
- Usable asset unit là thiết bị `isActive = true`, `deletedAt = null`, không ở trạng thái `MAINTENANCE`, `RETIRED`, `LOST`, và condition không phải `LOST`.
- Nếu admin chọn quantity theo product mà chưa gán serial, backend vẫn phải tính số lượng còn trống từ các asset unit usable và order overlap.
- Trước khi bàn giao, staff nên gán serial cụ thể cho từng item quantity = 1.

### Rental order core flow

```txt
check-availability
-> create DRAFT
-> assign asset units when needed
-> confirm
-> cancel/delete draft if needed
```

Quy tắc:

- `DRAFT` chưa phải trạng thái block lịch.
- Khi `CONFIRMED`, order bắt đầu block lịch theo `startDate` đến `blockedEndDate`.
- Confirm phải re-check availability vì lịch có thể thay đổi sau lúc tạo draft.
- Update order chỉ nên cho ở `DRAFT`, trừ khi có nghiệp vụ cụ thể cho phép manager sửa sau confirm.
- Delete chỉ nên là soft delete và chỉ áp dụng cho `DRAFT` hoặc `CANCELLED`.
- Create/update/confirm/cancel nên ghi `OrderStatusHistory` hoặc `OrderEvent` tương ứng.

### Payment flow

```txt
record HOLD_FEE / RENTAL_FEE / DEPOSIT / DELIVERY_FEE
-> update paidTotal
-> update remainingTotal
-> update paymentStatus
-> write OrderEvent PAYMENT_RECORDED
```

Quy tắc:

- `PaymentRecord` là từng lần thu/hoàn tiền thủ công, không phải tổng tiền.
- `paidTotal` là tổng các payment `SUCCESS` không phải `REFUND`.
- `remainingTotal` là số tiền còn phải thu.
- `paymentStatus` nên là:
  - `UNPAID` nếu chưa thu gì.
  - `PARTIALLY_PAID` nếu đã thu một phần.
  - `PAID` nếu đã thu đủ amount cần thu.
  - `PARTIALLY_REFUNDED` hoặc `REFUNDED` sau refund.
- Không tự xác nhận online payment trong Phase 1.

### Handover flow

```txt
CONFIRMED
-> PREPARING
-> READY_FOR_PICKUP / DELIVERING
-> OUTBOUND handover
-> RENTING
```

Quy tắc:

- Trước khi bàn giao, order nên có asset unit cụ thể cho các item cần quản lý serial.
- Khi bàn giao, tạo `OrderHandover` type `OUTBOUND`.
- Handover cần lưu staff xử lý, thời gian, tình trạng, phụ kiện và ghi chú.
- Sau outbound handover, trạng thái order chuyển sang `RENTING`.
- Nếu cửa hàng giao hàng, dùng `DELIVERING` trước khi chuyển sang `RENTING`.

### Return / inspection / damage flow

```txt
RENTING
-> RETURNED
-> create RETURN handover
-> create ReturnInspection
-> create DamageReport(s) if needed
-> calculate lateFee/damageFee/refundTotal/remainingTotal
-> COMPLETED or DISPUTED
```

Quy tắc:

- Khi nhận lại thiết bị, tạo `OrderHandover` type `RETURN`.
- `actualReturnDate` dùng để tính trễ hạn.
- `ReturnInspection` là kết quả kiểm tra tổng quát sau trả.
- `DamageReport` là chi tiết từng lỗi/mất/hư hỏng theo product/asset unit.
- Nếu có phí phát sinh, cập nhật `lateFeeTotal`, `damageFeeTotal`, `remainingTotal`.
- Nếu còn tiền cọc cần hoàn, cập nhật `refundTotal`.
- Nếu có tranh chấp, chuyển `DISPUTED`, chưa complete.

### Refund / settlement flow

```txt
calculate refundTotal
-> record PaymentRecord REFUND
-> update paymentStatus
-> COMPLETED / REFUNDED when settled
```

Quy tắc:

- Refund cũng là `PaymentRecord`, kind = `REFUND`, amount dương.
- Không trừ âm vào payment amount.
- `refundTotal` là số tiền cần hoàn sau khi trừ phí trễ/hư hỏng/mất phụ kiện.
- Khi đã thu/hoàn đủ và không còn tranh chấp, order có thể chuyển `COMPLETED`.

### Audit/event flow

```txt
status change -> OrderStatusHistory
important action -> OrderEvent
money action -> PaymentRecord + OrderEvent
handover action -> OrderHandover + OrderEvent
inspection action -> ReturnInspection/DamageReport + OrderEvent
```

Quy tắc:

- `OrderStatusHistory` chỉ ghi chuyển trạng thái.
- `OrderEvent` ghi nhật ký tổng quát để UI hiển thị timeline/audit.
- Không cần trả toàn bộ `payments`, `statusHistories`, `handovers`, `returnInspections`, `events` trong response list order.
- Detail order nên trả core fields + `items`; các tab payment/history/handover/inspection/event có thể dùng endpoint riêng.

## 15. RBAC và hiển thị UI theo quyền

FE không chỉ ẩn nút theo role name, mà nên dựa trên permission code backend trả về sau đăng nhập.

Ví dụ permission:

| Permission | UI được phép |
| --- | --- |
| `orders.read` | Xem danh sách/chi tiết đơn |
| `orders.create` | Tạo đơn thuê |
| `orders.update` | Sửa thông tin đơn |
| `orders.update_status` | Chuyển trạng thái đơn |
| `orders.cancel` | Hủy đơn |
| `orders.record_payment` | Ghi nhận thanh toán |
| `orders.refund` | Ghi nhận hoàn tiền |
| `customers.read` | Xem khách hàng |
| `customers.create` | Tạo khách hàng |
| `customers.update` | Sửa khách hàng |
| `products.read` | Xem sản phẩm |
| `products.create` | Tạo sản phẩm |
| `products.update` | Sửa sản phẩm |
| `products.delete` | Xóa/ngừng sản phẩm |
| `assets.read` | Xem thiết bị |
| `assets.create` | Tạo thiết bị |
| `assets.update` | Sửa thiết bị |
| `assets.delete` | Xóa/ngừng thiết bị |
| `users.read` | Xem người dùng nội bộ |
| `users.create` | Tạo người dùng nội bộ |
| `users.update` | Sửa người dùng, trạng thái, role |
| `users.delete` | Xóa mềm người dùng |
| `roles.read` | Xem vai trò |
| `roles.create` | Tạo vai trò |
| `roles.update` | Sửa vai trò/quyền trong vai trò |
| `roles.delete` | Xóa vai trò |
| `reports.read` | Xem báo cáo |

Quy tắc UI:

- Không có quyền thì ẩn action chính.
- Nếu action quan trọng cần giải thích, có thể disable và tooltip `Bạn không có quyền thực hiện thao tác này`.
- Backend vẫn phải kiểm tra quyền, không tin vào FE.
- Nếu user có nhiều role, quyền hiệu lực là hợp của tất cả permission trong các role.
- UI không nên hardcode quyền theo role name như `ADMIN` hay `STAFF`; chỉ role management UI mới cần hiển thị role code/name.

## 16. Quản lý người dùng, vai trò và quyền

Mục tiêu là quản lý tài khoản nội bộ và quyền truy cập bằng RBAC. Không lưu một enum role trực tiếp trên `User`.

```txt
User
-> UserRole
-> Role
-> RolePermission
-> Permission
```

### Trang và flow tổng quát

Trang nên có:

```txt
/users
/users/:id
/roles
/roles/:id
/permissions
```

Flow tạo user:

```txt
Create user
-> Nhập email, họ tên, phone, password
-> Chọn role(s), mặc định STAFF nếu không chọn
-> Save
-> User detail hiển thị role và permission hiệu lực
```

Flow đổi role của user:

```txt
User detail
-> Edit roles
-> Chọn nhiều role
-> Save
-> Backend replace UserRole hiện tại
-> Refresh user detail
```

Flow tạo/sửa role:

```txt
Roles list
-> Create/Edit role
-> Nhập code, name, description
-> Chọn permissions theo module group
-> Save Role + RolePermission
```

Flow xem permission:

```txt
Permissions page
-> List permission seed từ backend
-> Group theo module: orders, customers, products, assets, users, roles, reports, settings
```

### Người dùng

Cột danh sách:

- Họ tên.
- Email.
- Số điện thoại.
- Vai trò.
- Trạng thái active.
- Lần đăng nhập cuối.
- Ngày tạo.

Form:

- Email.
- Họ tên.
- Số điện thoại.
- Mật khẩu khi tạo hoặc đổi mật khẩu.
- Active/inactive.
- Vai trò.

Không lưu role enum trực tiếp trên user. User nhận quyền thông qua `UserRole`, `Role`, `RolePermission`.

Hành động:

- Tạo user: page hoặc large drawer.
- Sửa thông tin user: drawer hoặc detail edit section.
- Đổi trạng thái hoạt động: confirm dialog nếu chuyển sang banned/locked/inactive.
- Đổi role: drawer/section riêng, có checklist roles.
- Xóa user: confirm dialog, không cho tự xóa tài khoản hiện tại.

Trạng thái user nên hiển thị bằng badge:

```txt
ACTIVE
BANNED
LOCKED
INACTIVE
```

### Vai trò

Cột danh sách:

- Code.
- Tên.
- Mô tả.
- System role.
- Số user.
- Số permission.

Form role:

- Code.
- Tên.
- Mô tả.
- Danh sách permission grouped theo module.

System role không nên cho xóa từ UI.

Role UI nên có:

- Badge `System` cho role seed mặc định.
- Số lượng user đang dùng role.
- Số lượng permission trong role.
- Tab `Users` để xem user đang có role này nếu cần.
- Tab `Permissions` để chỉnh quyền.

Khi sửa permissions của role:

- Hiển thị permissions theo group module.
- Có checkbox group `Select all` theo từng module.
- Có search permission.
- Có summary số permission đã chọn.
- Cảnh báo: `Thay đổi quyền sẽ ảnh hưởng tất cả người dùng đang dùng vai trò này`.

Không nên cho sửa `code` của system role nếu code đang được seed hoặc dùng trong logic phân quyền mặc định.

### Permission

Permission là capability kỹ thuật/nghiệp vụ, ví dụ:

```txt
orders.read
orders.create
orders.update
orders.update_status
orders.cancel
orders.record_payment
orders.refund
customers.read
products.read
assets.read
users.read
roles.read
settings.read
reports.read
```

UI permission page chủ yếu để xem và tra cứu. Phase 1 không nhất thiết cho tạo permission từ UI vì permission nên được seed từ backend để tránh code/frontend/backend lệch nhau.

### Dialog/modal cho RBAC

Confirm dialog cần có:

- Delete user.
- Delete role.
- Change user to banned/locked/inactive.
- Save role permission changes nếu role đang có nhiều user.

Không nên dùng modal nhỏ cho:

- Edit role permissions.
- View effective permissions of user.
- Compare permissions between roles.

Các phần này nên là page/detail tab để dễ scan.

## 17. Báo cáo

Phase 1 nên có báo cáo vận hành cơ bản:

- Doanh thu theo ngày/tháng.
- Tiền cọc đang giữ.
- Đơn còn nợ.
- Đơn quá hạn.
- Sản phẩm được thuê nhiều.
- Thiết bị đang bảo trì/hư hỏng/mất.
- Tỷ lệ hủy đơn.

Giao diện báo cáo:

- Bộ lọc thời gian.
- Export CSV/XLSX nếu sau này cần.
- Click vào số liệu để drill down sang danh sách liên quan.

## 18. Cấu trúc form và validation chung

### Ngày giờ

- Hiển thị theo timezone cửa hàng.
- Format gợi ý: `dd/MM/yyyy HH:mm`.
- Luôn phân biệt ngày bắt đầu thuê, ngày dự kiến trả và ngày trả thực tế.

### Tiền tệ

- Format VND: `1.500.000 ₫`.
- Input số tiền không nên cho nhập số âm.
- Refund nhập số dương, loại tiền quyết định chiều tiền.

### UUID

- Không hiển thị UUID làm thông tin chính cho người dùng.
- Dùng mã người đọc được như mã đơn, mã khách, SKU, serial.
- UUID chỉ dùng trong route/API/internal state.

### Soft delete

- Với khách hàng, sản phẩm, thiết bị, đơn: ưu tiên ngừng hoạt động/soft delete.
- Không hard-delete dữ liệu đã có lịch sử đơn.

## 19. API FE nên cần từ backend

Tên endpoint có thể thay đổi theo implementation, nhưng FE thường cần các nhóm API sau.

### Auth

- Đăng nhập.
- Lấy profile hiện tại.
- Lấy permission của user hiện tại.
- Đổi mật khẩu/đăng xuất nếu cần.

### Customers

- Danh sách khách hàng có phân trang/filter.
- Chi tiết khách hàng.
- Tạo/sửa khách hàng.
- Chặn/mở chặn khách hàng.

### Products

- Danh sách sản phẩm.
- Chi tiết sản phẩm.
- Tạo/sửa/ngừng sản phẩm.
- Danh mục.
- Thương hiệu.

### Asset units

- Danh sách thiết bị.
- Chi tiết thiết bị.
- Tạo/sửa/ngừng thiết bị.
- Lịch thuê của thiết bị.

### Rental orders

- Danh sách đơn có filter.
- Chi tiết đơn.
- Tạo nháp.
- Cập nhật đơn nháp.
- Xác nhận đơn.
- Chuyển trạng thái.
- Hủy đơn.
- Gán nhân viên phụ trách.
- Gán/đổi asset unit.
- Lấy timeline/audit.

### Availability

- Kiểm tra khả dụng theo product/time/quantity.
- Kiểm tra khả dụng theo asset unit/time.
- Gợi ý serial khả dụng cho một product trong khoảng thuê.

### Payments

- Danh sách payment record.
- Ghi nhận thanh toán.
- Ghi nhận hoàn tiền.
- Hủy payment record nếu nghiệp vụ cho phép.

### Returns

- Nhận trả thiết bị.
- Tạo inspection.
- Thêm damage report.
- Cập nhật phí trễ/phí hư hỏng.
- Tất toán đơn.

### Reports

- Dashboard summary.
- Báo cáo doanh thu.
- Báo cáo công nợ.
- Báo cáo thiết bị.

## 20. Wireframe chữ cho các màn hình chính

### Danh sách đơn

```txt
[Header: Đơn thuê]                                  [Tạo đơn thuê]

[Search mã đơn/khách/SĐT] [Trạng thái] [Thanh toán] [Khoảng ngày thuê] [Nhân viên] [Xóa lọc]

| Mã đơn | Khách hàng | Thời gian thuê | Trạng thái | Thanh toán | Tổng | Còn lại | Phụ trách | Actions |
| RO-001 | Nguyễn A  | 10/06 - 12/06  | Đang thuê  | Một phần   | ...  | ...     | Staff 1   | ...     |

[Pagination]
```

### Tạo đơn

```txt
[Tạo đơn thuê]

Step 1 Khách hàng -> Step 2 Thời gian -> Step 3 Sản phẩm -> Step 4 Tổng tiền

[Thông tin khách]
[Thời gian thuê]
[Danh sách item]
[Tổng tiền]
[Ghi chú]

[Lưu nháp] [Xác nhận đơn]
```

### Chi tiết đơn

```txt
[RO-001] [Đang thuê] [Thanh toán một phần]       [Ghi nhận thanh toán] [Nhận trả thiết bị] [...]

Thông tin chính:
- Khách hàng snapshot
- Thời gian thuê
- Phương thức nhận/giao
- Nhân viên phụ trách

Tabs:
[Tổng quan] [Thiết bị và bàn giao] [Thanh toán] [Trả hàng] [Lịch sử]

Sidebar:
- Timeline trạng thái
- Audit events
- Ghi chú nội bộ
```

### Kiểm tra trả hàng

```txt
[Kiểm tra trả hàng - RO-001]

[Thời gian trả thực tế]
[Danh sách thiết bị trả]
  - Sony A7 IV / SN001 / Tình trạng / Ghi chú
  - Lens 24-70 / SN010 / Tình trạng / Ghi chú

[Phí trễ] [Phí hư hỏng] [Phí mất phụ kiện]
[Damage reports]
[Kết quả kiểm tra]

[Lưu kiểm tra] [Ghi nhận thu thêm] [Ghi nhận hoàn tiền] [Hoàn tất đơn]
```

## 21. Những thứ không làm trong Phase 1

Không đưa các phần sau vào UI/API Phase 1 nếu chưa có yêu cầu riêng:

- Giỏ hàng.
- Checkout endpoint.
- Guest session.
- Khách tự đặt đơn trên website.
- Callback VNPay/MoMo.
- Tự động xác nhận thanh toán online.
- Tự hết hạn đơn chờ thanh toán giữ chỗ.
- Trạng thái checkout như `AWAITING_HOLD_PAYMENT`, `AWAITING_CONFIRMATION`, `EXPIRED`.

## 22. Checklist nghiệm thu Phase 1

Một bản admin UI Phase 1 được xem là đạt khi:

- Admin/staff tạo được đơn thuê từ khách hàng có sẵn hoặc khách tạo nhanh.
- Đơn lưu snapshot khách hàng và snapshot giá sản phẩm.
- Có thể lưu nháp và xác nhận đơn.
- Khi xác nhận đơn, hệ thống chặn thiết bị/số lượng theo overlap thời gian.
- Không thể gán cùng một serial cho hai đơn overlap.
- Có thể chuyển trạng thái theo luồng vận hành.
- Mỗi lần đổi trạng thái có lịch sử.
- Có thể ghi nhận tiền cọc, tiền thuê, phí và hoàn tiền thủ công.
- Có thể bàn giao thiết bị và lưu ghi chú tình trạng.
- Có thể nhận trả, kiểm tra, ghi nhận phí hư hỏng/trễ/mất phụ kiện.
- Có thể tất toán đơn khi tiền và tình trạng đã xử lý.
- Có RBAC để ẩn/chặn hành động theo permission.
- Không có checkout/cart/customer self-service trong Phase 1.
