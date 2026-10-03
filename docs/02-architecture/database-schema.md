# Mô hình cơ sở dữ liệu hiện tại

> Tài liệu này phải khớp với `prisma/schema.prisma`. Prisma schema là nguồn sự thật cho cấu trúc bảng; các migration cũ chỉ là lịch sử thay đổi.

## 1. Nhóm thực thể hiện tại

### Nhân sự và phân quyền

- `User`: tài khoản admin/staff đăng nhập và thực hiện thao tác.
- `Role`: vai trò nghiệp vụ.
- `Permission`: danh mục quyền ổn định.
- `UserRole`: liên kết người dùng với vai trò.
- `RolePermission`: liên kết vai trò với quyền.

### Khách hàng và catalog

- `Customer`: hồ sơ khách hàng dùng để liên hệ và tạo đơn.
- `Product`: loại/model sản phẩm cho thuê, không phải một máy vật lý.
- `ProductCategory`: danh mục sản phẩm.
- `Brand`: thương hiệu sản phẩm.
- `ProductCategoryAssignment`: liên kết nhiều-nhiều giữa product và category.
- `ProductRentalPriceTier`: bậc giá thuê theo số ngày.
- `AssetUnit`: một thiết bị vật lý có serial, trạng thái và tình trạng riêng.

### Cấu hình cửa hàng

- `SystemSettings`: cấu hình thuê cấp cửa hàng dạng singleton.
- `StoreBusinessHour`: giờ mở cửa định kỳ theo thứ trong tuần.
- `StoreClosure`: các khoảng nghỉ, lễ, bảo trì hoặc chặn hoạt động.

### Đơn thuê và lịch thiết bị

- `RentalOrder`: aggregate gốc của đơn thuê, gồm trạng thái, snapshot và các tổng tiền.
- `RentalOrderQuote`: báo giá tạm thời trước khi tạo hoặc cập nhật lịch đơn.
- `RentalOrderLine`: dòng product và số lượng trong đơn, lưu snapshot giá.
- `RentalAssetAllocation`: phân bổ asset unit vào dòng đơn trong một khoảng thời gian.
- `OrderStatusHistory`: lịch sử chuyển `OrderStatus`.
- `RentalOrderLog`: audit chi tiết thay đổi/hành động trên đơn; schema đã có nhưng service hiện chưa wire.

### Tài chính

- `RentalOrderCharge`: các khoản phải thu như tiền thuê, giữ lịch, cọc, phí trễ hoặc đền bù.
- `PaymentTransaction`: giao dịch tiền vào/ra; flow hiện tại mới sử dụng tiền vào.
- `PaymentAllocation`: phân bổ một payment vào một hoặc nhiều charge.
- `Refund`: yêu cầu và kết quả hoàn tiền.

### Kiểm tra và sự cố

- `RentalInspection`: phiên kiểm tra lúc bàn giao hoặc nhận trả.
- `RentalInspectionItem`: kết quả kiểm tra từng allocation.
- `RentalInspectionAccessory`: số lượng/trạng thái phụ kiện trong một inspection item.
- `RentalIncident`: sự cố có thể phát sinh phí, như hư hỏng, mất máy, thiếu phụ kiện hoặc trả trễ.

### Email

- `EmailLayout`: khung HTML dùng chung.
- `EmailTemplate`: mẫu email nghiệp vụ, subject, HTML và biến động.

## 2. Nguyên tắc dữ liệu quan trọng

### Product và AssetUnit

`Product` là loại/model; `AssetUnit` là máy thực tế. Số lượng máy của một product được tính từ các asset unit phù hợp, không lưu thêm một bảng tồn kho thứ hai.

### Snapshot

`RentalOrder.customerSnapshot`, `RentalOrder.settingsSnapshot`, `RentalOrderLine.pricingSnapshot` và các snapshot liên quan bảo vệ lịch sử đơn khi khách hàng, cấu hình hoặc giá hiện tại thay đổi. Đây là dữ liệu lịch sử có chủ đích, không phải bản ghi dư.

### Tài chính

Nguồn dữ liệu tài chính chi tiết là:

1. `RentalOrderCharge` xác định nghĩa vụ của khách.
2. `PaymentTransaction` ghi nhận tiền đã thu.
3. `PaymentAllocation` cho biết tiền đã được phân bổ vào charge nào.
4. `Refund` ghi nhận yêu cầu và số tiền hoàn thực tế.

Các tổng tiền trên `RentalOrder` là projection/cache phục vụ list và detail. Mọi mutation charge, payment hoặc refund phải gọi `recalculateOrder` trong cùng transaction để tránh lệch số.

### Allocation và availability

`RentalAssetAllocation` là nguồn lịch giữ máy. Không tạo thêm `AssetReservation` cho cùng mục đích. `blockedEndDate` lưu mốc giải phóng máy sau buffer và được dùng khi kiểm tra giao nhau.

### Inspection và Incident

`RentalInspection` ghi nhận quan sát tại thời điểm kiểm tra; `RentalIncident` ghi nhận vấn đề cần xử lý hoặc có thể phát sinh phí. Hai model không thay thế nhau.

## 3. Index và tìm kiếm

- Các khóa ngoại và trường lọc/sắp xếp chính có index tương ứng trong schema.
- `User`, `Customer`, `Product`, `AssetUnit` và `RentalOrder` dùng `searchText` cùng GIN trigram `pg_trgm` cho tìm kiếm không dấu.
- Các model có soft delete phải lọc `deletedAt: null` ở service; không dựa vào middleware ẩn để tránh truy vấn khó kiểm tra.
- Các bảng lớn nên dùng secondary sort theo `id` khi phân trang để kết quả ổn định.

## 4. Các bảng legacy không còn thuộc schema hiện tại

> Những tên dưới đây có thể còn xuất hiện trong migration lịch sử hoặc tài liệu cũ nhưng không được dùng làm model hiện tại:

- `RentalPolicy`;
- `RentalOrderItem`;
- `PaymentRecord`;
- `AssetReservation`;
- `OrderHandover`;
- `ReturnInspection`;
- `DamageReport`;
- `OrderEvent`;
- `EmailLog`.

Không dùng danh sách legacy để viết query hoặc DTO mới. Khi cần xác nhận cấu trúc thật, đọc `prisma/schema.prisma` và chạy `pnpm exec prisma validate`.
