# Kế hoạch nâng cấp và mở rộng Rental Admin

> Trạng thái: đề xuất đã thống nhất ở mức product roadmap, chưa phải API contract hoặc Prisma migration.
>
> Cập nhật: 2026-10-03

Tài liệu này tổng hợp hướng nâng cấp Rental Admin sau giai đoạn nền tảng: vận hành cho thuê thiết bị, theo dõi máy góp vốn, chia doanh thu cho chủ máy, voucher, giao nhận, hợp đồng, tài chính, báo cáo và CMS/PIM.

## 1. Phạm vi và nguyên tắc

Rental Admin vẫn là hệ thống admin-first. Nhân viên vận hành là người tạo đơn, xác nhận thanh toán, bàn giao/nhận trả thiết bị và xử lý sự cố; khách hàng chưa phải là người dùng tự phục vụ trong phạm vi MVP.

Các nguyên tắc cần giữ trong mọi phase:

- PostgreSQL + Prisma là nguồn dữ liệu nghiệp vụ chính. Không tạo MongoDB riêng chỉ để ghi log API ở giai đoạn hiện tại.
- Tách rõ `Dashboard` vận hành, `Reports` phân tích và `Finance`/`Settlement` đối soát tài chính.
- `Product` là loại sản phẩm; `AssetUnit` là máy vật lý có serial. Trạng thái, bảo trì và khả dụng của máy không quản lý bằng CMS.
- Lịch khả dụng phải cho phép xem lịch hiện tại và tạo đơn/booking ngay từ khoảng thời gian còn trống.
- Dữ liệu lịch sử phải lưu snapshot tại thời điểm phát sinh: giá, voucher, khách hàng, serial, phí giao nhận và quy tắc chia doanh thu không được tính lại tùy tiện sau này.
- Các thao tác làm thay đổi tiền, trạng thái đơn, tài sản hoặc quyền phải có audit trail và permission riêng.
- Mỗi phase phải có tiêu chí nghiệm thu và kiểm thử luồng nghiệp vụ hoàn chỉnh trước khi mở rộng sidebar.

## 2. Hiện trạng làm mốc

Đây là mốc đối chiếu với source code và Prisma schema hiện tại; các dòng “một phần” cần được kiểm thử lại ở cả backend và frontend trước khi đánh dấu hoàn thành trong roadmap cũ.

| Khu vực | Hiện trạng | Khoảng trống chính |
|---|---|---|
| Auth/RBAC | Đã có khung người dùng, vai trò, quyền và guard | Bổ sung permission cho các domain mới, audit quyền và ma trận role |
| Khách hàng | Có module khách hàng | Bổ sung lịch sử thuê, công nợ, blacklist/risk và liên kết hợp đồng |
| Danh mục | Có product, category, brand, giá thuê | Bổ sung nội dung sản phẩm, phụ kiện, version giá và import/export nếu cần |
| Thiết bị vật lý | Có `AssetUnit`, serial, trạng thái và khả dụng theo allocation | Bổ sung bảo trì, chi phí tài sản, chủ máy và lịch sử sở hữu |
| Đơn thuê | Có quote/create/list/detail và các thao tác vòng đời ở backend | Hoàn thiện flow UI, worklist, validation chuyển trạng thái và test end-to-end |
| Lịch khả dụng | Có API/query và màn hình timeline | Tạo đơn trực tiếp từ lịch; hiển thị buffer, hold, giao nhận và cảnh báo xung đột |
| Bàn giao/nhận trả | Có khung endpoint/nghiệp vụ | Hoàn thiện checklist, ảnh/chữ ký, incident, phí hư hỏng và xử lý ngoại lệ |
| Thanh toán | Schema có charge/payment/refund và controller có thao tác liên quan | Hoàn thiện sổ giao dịch, đối soát, quyền duyệt và báo cáo dòng tiền |
| Dashboard | Có dashboard vận hành và attention/trends | Không dùng dashboard thay cho báo cáo tài chính hoặc báo cáo doanh thu chính thức |
| Email | Có layout/template, preview và send-test theo permission | Gắn template vào event đơn, thanh toán, hợp đồng và giao nhận |
| Voucher, giao nhận, hợp đồng | Chưa có model/module nghiệp vụ tương ứng trong schema hiện tại | Thiết kế ở P2 sau khi core order/payment ổn định |
| Chủ máy/chia doanh thu | Chưa có model sở hữu và kỳ đối soát | Thiết kế ở P3, cần chốt chính sách doanh thu/chi phí trước khi code |
| CMS/PIM | Chưa có content model/module | Chỉ làm sau khi catalog và flow thuê đã ổn định; không thay thế domain asset |

## 3. Sidebar và sitemap mục tiêu

Sidebar nên phản ánh các bounded context nghiệp vụ. Chỉ hiển thị mục khi route, permission và trạng thái triển khai đã sẵn sàng; mục `coming soon` không nên dẫn tới màn hình giả hoặc API chưa có.

| Nhóm | Chức năng | Route dự kiến | Ưu tiên |
|---|---|---|---|
| Tổng quan | Dashboard vận hành: đơn cần xử lý, máy đang thuê, quá hạn, thanh toán chờ duyệt | `/dashboard` | P0/P1 |
| Vận hành thuê | Đơn thuê | `/rental-orders` | P1 |
| Vận hành thuê | Lịch & đặt thuê: xem lịch hiện tại, kiểm tra trống và tạo booking | `/availability` | P1 |
| Vận hành thuê | Giao nhận, shipper, bằng chứng giao/nhận | `/deliveries` | P2 |
| Vận hành thuê | Hợp đồng thuê và trạng thái ký | `/rental-contracts` | P2 |
| Danh mục & kho | Sản phẩm | `/products` | Đã có/P1 |
| Danh mục & kho | Danh mục | `/categories` | Đã có/P1 |
| Danh mục & kho | Thương hiệu | `/brands` | Đã có/P1 |
| Danh mục & kho | Thiết bị vật lý theo serial | `/asset-units` | Đã có/P1 |
| Danh mục & kho | Bảo trì, hỏng, mất, lịch sử sửa chữa | `/maintenance` | P1/P2 |
| Tài sản & góp vốn | Chủ máy/đối tác góp vốn | `/contributors` | P3 |
| Tài sản & góp vốn | Tài sản góp vốn và tỷ lệ sở hữu | `/asset-ownerships` | P3 |
| Tài sản & góp vốn | Hiệu suất/ROI từng máy | `/asset-performance` | P3/P4 |
| Tài chính & đối soát | Tổng quan tài chính | `/finance` | P1/P4 |
| Tài chính & đối soát | Giao dịch thu/chi, payment, refund | `/finance/transactions` | P1 |
| Tài chính & đối soát | Chi phí | `/expenses` | P3/P4 |
| Tài chính & đối soát | Đối soát và chia doanh thu | `/settlements` | P3 |
| Tài chính & đối soát | Kỳ thanh toán và phiếu chi trả | `/settlement-periods`, `/payouts` | P3 |
| Bán hàng | Voucher/campaign/mã giảm giá | `/vouchers` | P2 |
| Báo cáo | Doanh thu, công suất, giao dịch, export | `/reports` | P4 |
| Báo cáo | ROI thiết bị, doanh thu chủ máy, dự báo, mục tiêu | Có thể là tab/filter trong `/reports` | P4 |
| Nội dung | Trang nội dung, bài viết, banner, media, SEO | `/content/*` | P5 |
| Quản trị hệ thống | Người dùng | `/users` | Đã có |
| Quản trị hệ thống | Vai trò & quyền | `/roles` | Đã có |
| Quản trị hệ thống | Cài đặt, giờ mở cửa, ngày đóng cửa | `/settings` | Đã có/P1 |
| Quản trị hệ thống | Mẫu email | `/mail-templates` | Đã có/P1 |
| Quản trị hệ thống | API log và audit log | `/audit-logs` | P0/P1 |

`Báo cáo` ở đây chính là `Reports`: báo cáo doanh thu, giao dịch, công suất, ROI và export. `Tổng quan tài chính` là màn hình điều hành dòng tiền, công nợ, khoản phải thu/phải trả và đối soát; hai khái niệm này không nên gộp làm một màn hình.

## 4. Thứ tự ưu tiên triển khai

### P0 — Nền tảng, quan sát hệ thống và chuẩn hóa quyền

Mục tiêu là làm cho mọi lỗi có thể truy vết trước khi thêm nhiều domain tiền bạc.

Chức năng:

- Chuẩn hóa sidebar, route guard, loading/error/empty state và permission matrix.
- Tách permission tối thiểu: `dashboard.read`, `reports.read`, `reports.export`, `audit_logs.read`, `api_logs.read` và các permission theo domain.
- Giữ tương thích `orders.read` cho dashboard hiện tại nếu cần, sau đó chuyển dần sang `dashboard.read`.
- Ghi log mọi request bằng structured JSON: `requestId`, method, route template, status code, duration, actor/user id, role, IP/user-agent đã lọc, error code và service/module.
- Propagate `requestId` qua service, queue/worker và outbound request để nối được một giao dịch từ frontend đến backend.
- Chỉ ghi body/query/header đã whitelist; tuyệt đối redact password, token, cookie, refresh token, giấy tờ tùy thân, thông tin thanh toán và dữ liệu nhạy cảm.
- Ghi business audit cho mutation quan trọng: tạo/sửa/xóa, đổi trạng thái đơn, gán/thu hồi máy, ghi nhận payment/refund, duyệt settlement, thay đổi permission và thay đổi cấu hình.
- Giữ `RentalOrderLog` cho lịch sử riêng của đơn; nếu cần audit toàn hệ thống thì thêm `AuditLog` trong Prisma, không dùng `RentalOrderLog` làm API log chung.

Định hướng lưu log:

| Loại log | Nơi lưu ban đầu | Thời gian lưu gợi ý | Mục đích |
|---|---|---|---|
| Request/error log kỹ thuật | stdout/JSON rồi đẩy sang hệ thống log tập trung | 7–30 ngày | Debug latency, 4xx/5xx, trace request |
| Business audit | PostgreSQL/Prisma (`AuditLog`) | ít nhất 1 năm hoặc theo chính sách | Biết ai thay đổi dữ liệu và trước/sau ra sao |
| API request searchable | PostgreSQL/Prisma (`ApiRequestLog`) chỉ khi cần tra cứu trong admin, ưu tiên lỗi/route nhạy cảm | ngắn hơn audit | Tra cứu nhanh theo requestId, actor, status |

Không nên tạo MongoDB riêng chỉ để log ở P0. Chỉ cân nhắc hệ thống log/warehouse chuyên dụng khi volume hoặc yêu cầu retention khiến PostgreSQL không còn phù hợp; đó là bài toán vận hành sau khi có số liệu thực tế.

Tiêu chí hoàn thành:

- Một lỗi 500 có thể tìm theo `requestId` từ UI/API response đến log backend.
- Một mutation tiền hoặc trạng thái có actor, timestamp, entity, action và before/after hoặc diff.
- Có test kiểm tra redact dữ liệu nhạy cảm và permission đọc log.

### P1 — Rental core: đơn thuê, lịch, bàn giao và thanh toán

Mục tiêu là hoàn chỉnh vòng đời thuê trước khi tính chia doanh thu.

Chức năng:

- Tạo quote/đơn từ màn hình lịch; chọn sản phẩm, serial hoặc để hệ thống gợi ý serial khả dụng.
- Hiển thị lịch hiện tại theo product/serial, turnaround/buffer, booking hold và cảnh báo xung đột.
- Worklist trong khu vực đơn thuê: bàn giao, nhận trả, quá hạn, payment cần xử lý, refund, inspection và dispute. Worklist là view vận hành, không nhất thiết là một domain mới.
- Hoàn chỉnh status transition: draft/created, confirmed, renting, returned, done/cancelled/disputed theo rule hiện có.
- Bàn giao và nhận trả: checklist phụ kiện, tình trạng trước/sau, ảnh, ghi chú, người thực hiện và timestamp.
- Incident/damage/late fee và các khoản phải thu phát sinh sau nhận trả.
- Payment transaction, allocation, refund, duyệt thủ công và đối soát số tiền; không dùng `paidTotal` như doanh thu nếu nghiệp vụ chưa xác định khoản đó là revenue.
- Màn hình chi tiết đơn phải hiển thị quote, lịch sử trạng thái, payment, refund, inspection, audit log và action được phép theo role.

Tiêu chí hoàn thành:

- Nhân viên xem lịch, tạo đơn ngay từ khoảng trống, bàn giao, nhận trả và kết thúc đơn không cần bảng tính ngoài.
- Không thể gán cùng một `AssetUnit` vào hai khoảng thời gian giao nhau theo availability rule.
- Số tiền của đơn được giải thích từ charge/payment/refund; các projection như total phải truy được nguồn.

### P2 — Bán hàng và hoàn tất dịch vụ: voucher, shipper, giao nhận, hợp đồng

#### 4.2.1 Voucher

Voucher thuộc nhóm pricing/sales, không thuộc CMS. MVP nên có:

- Campaign hoặc chương trình khuyến mãi.
- Mã voucher, kiểu giảm phần trăm/số tiền, trần giảm, thời hạn và trạng thái.
- Điều kiện: giá trị đơn tối thiểu, product/category/brand, số ngày thuê, khách hàng, số lần dùng, số lượt toàn chương trình.
- Rule kết hợp voucher, phí áp dụng/không áp dụng và quyền override thủ công.
- Quote preview trước khi tạo đơn; snapshot discount/rule tại thời điểm order.
- `VoucherRedemption` gắn với đơn, actor và thời điểm; chống dùng trùng hoặc race condition.
- Báo cáo tác động voucher: số đơn, doanh thu gộp, discount, doanh thu sau giảm và ảnh hưởng đến chia doanh thu.

Không được lấy lại rule voucher hiện tại để tính lại đơn lịch sử. Voucher phải lưu discount snapshot trong order/charge.

#### 4.2.2 Shipper và giao nhận

Nên tách người giao hàng khỏi `Customer`. Các aggregate dự kiến:

- `Shipper`: nhân viên nội bộ hoặc đối tác, thông tin liên hệ, phương tiện, trạng thái hoạt động.
- `DeliveryOrder`: yêu cầu giao/nhận gắn với `RentalOrder`, loại pickup/return, địa chỉ snapshot, khung giờ, phí khách trả và chi phí vận hành.
- `DeliveryAssignment`: shipper, người phân công, thời điểm nhận việc và lý do đổi người.
- `DeliveryEvent`: assigned, picked up, in transit, delivered, failed, cancelled, cùng timestamp và actor.
- `DeliveryProof`: ảnh, chữ ký, mã xác nhận, ghi chú và người xác nhận.

Trạng thái nên có `PENDING_ASSIGNMENT`, `ASSIGNED`, `PICKED_UP`, `IN_TRANSIT`, `DELIVERED`, `FAILED`, `CANCELLED`. Luôn tách `deliveryFeeCharged` với `deliveryCost`; phí khách trả không tự động là lợi nhuận hay phần chia cho chủ máy.

#### 4.2.3 Hợp đồng cho thuê

MVP nên bắt đầu từ tab/action trong chi tiết đơn, sau đó mới tách màn hình quản lý riêng:

- `RentalContract`, `ContractTemplate`, `ContractVersion`, `ContractDocument`, `ContractEvent`.
- Trạng thái: `DRAFT`, `ISSUED`, `SENT`, `SIGNED`, `ACTIVE`, `COMPLETED`, `CANCELLED`, `EXPIRED`.
- Contract snapshot: khách hàng, giấy tờ/địa chỉ theo chính sách bảo mật, sản phẩm và serial, thời gian, giá/charge, voucher, delivery, cọc, trách nhiệm, late/damage/refund rule.
- Render PDF từ template version cố định; lưu document metadata và checksum.
- Audit việc phát hành, gửi, ký, thay thế và hủy hợp đồng. E-sign bên thứ ba là phase sau nếu chưa có yêu cầu pháp lý rõ.

Tiêu chí hoàn thành P2:

- Một đơn có thể áp voucher, tạo yêu cầu giao/nhận, phát hành hợp đồng và theo dõi trạng thái mà không sửa tay dữ liệu lịch sử.
- Delivery và contract không làm thay đổi trực tiếp asset availability; chúng liên kết vào order và dùng allocation/order làm nguồn sự thật.

### P3 — Tài sản góp vốn, chủ máy và đối soát chia doanh thu

Mục tiêu là biết máy nào góp vốn, máy được thuê bao nhiêu và số tiền nào phải trả cho từng chủ máy.

Không dùng `Customer` để đại diện chủ máy nếu chủ máy có quyền sở hữu, hợp đồng và settlement riêng. Các model/aggregate dự kiến:

- `Contributor`: cá nhân/doanh nghiệp góp vốn hoặc chủ máy.
- `AssetOwnership`: contributor, asset unit, tỷ lệ sở hữu hoặc quyền hưởng, ngày hiệu lực, ngày kết thúc, chứng từ và trạng thái.
- `RevenueShareAgreement`: công thức chia theo asset/product/order, tỷ lệ, mức tối thiểu, phí được khấu trừ, ngày hiệu lực và version chính sách.
- `AssetExpense`: bảo trì, khấu hao theo chính sách nội bộ, vận chuyển, bảo hiểm hoặc chi phí được phép khấu trừ.
- `SettlementPeriod`: kỳ đối soát.
- `SettlementStatement` và `SettlementLine`: snapshot doanh thu/chi phí/điều chỉnh của từng contributor.
- `Payout` và `SettlementAdjustment`: phiếu chi trả, hoàn/điều chỉnh, lý do và approval.

Liên kết nghiệp vụ cần truy được:

`Contributor → AssetOwnership → AssetUnit → RentalAssetAllocation → RentalOrder → Charge/Payment → SettlementLine`.

Quy tắc cần chốt trước khi code:

- Chia theo doanh thu kiếm được (earned revenue) hay theo tiền đã thu; mặc định nên dùng earned revenue và tách công nợ.
- Tiền cọc có phải doanh thu hay chỉ là khoản nợ phải hoàn; mặc định không đưa cọc vào doanh thu.
- Voucher giảm vào phần của ai, và discount có phân bổ theo line/asset như thế nào.
- Late fee, damage compensation, delivery fee, refund, cancellation fee và chi phí bảo trì có được chia hay khấu trừ không.
- Một asset có nhiều contributor thì phân bổ theo tỷ lệ sở hữu tại thời điểm order/settlement nào.
- Sau khi kỳ được duyệt, dữ liệu gốc không sửa trực tiếp; mọi thay đổi đi qua adjustment có lý do.

Trạng thái settlement đề xuất: `DRAFT → CALCULATED → PENDING_APPROVAL → APPROVED → PAID`, thêm `DISPUTED` cho ngoại lệ.

Tên menu MVP nên là **Đối soát & chia doanh thu** thay vì **Chia lợi nhuận**. Chỉ dùng “lợi nhuận” khi hệ thống đã có chính sách cost allocation đáng tin cậy; nếu chưa, hệ thống mới đang chia revenue.

Tiêu chí hoàn thành:

- Từ một settlement line có thể drill-down về đơn, line sản phẩm, serial, charge, voucher, chi phí và rule version.
- Có preview trước khi duyệt, cơ chế khóa kỳ và audit approve/payout.
- Không tính payout bằng tổng tiền thu đơn giản hoặc bằng dữ liệu hiện tại của asset ownership nếu lịch sử đã thay đổi.

### P4 — Tài chính, báo cáo, ROI, mục tiêu và dự báo

Mục tiêu là biến dữ liệu vận hành thành thông tin điều hành có thể đối soát.

Phân biệt rõ:

- `Dashboard`: hôm nay có gì cần xử lý, đơn sắp giao/trả, máy đang thuê, quá hạn, payment chờ duyệt.
- `Reports`: số liệu theo kỳ và bộ lọc để phân tích/export.
- `Finance`: charge, payment, refund, receivable/payable, expense và settlement.

Báo cáo ưu tiên:

- Doanh thu theo ngày/tháng, product/category/brand, channel và trạng thái; định nghĩa revenue phải ghi rõ nguồn charge.
- Tổng đơn, utilization/công suất theo asset và thời gian không sử dụng.
- Payment/refund/receivable và đối soát giao dịch.
- Chi phí vận hành, chi phí theo asset và biên đóng góp nếu đã có cost policy.
- Doanh thu, chi phí, số ngày thuê, ROI/payback của từng máy và từng contributor.
- Voucher impact, delivery cost/fee và các khoản điều chỉnh.
- Revenue target theo kỳ và tiến độ đạt mục tiêu.
- Forecast chỉ sau khi dữ liệu lịch sử đủ tin cậy; phải gắn nhãn dự báo, không trình bày như số thực tế.
- Export CSV/XLSX/PDF theo permission và filter snapshot.

Tiêu chí hoàn thành:

- Một con số trên report có định nghĩa, nguồn dữ liệu, timezone, kỳ tính và cách xử lý refund/cancel.
- Report tài chính đối soát được với payment/refund/settlement, không lấy trực tiếp số card của dashboard làm nguồn.

### P5 — CMS/PIM và quản lý nội dung

Nên có CMS, nhưng triển khai sau catalog và rental core. CMS/PIM phục vụ nội dung bán hàng, không điều khiển nghiệp vụ thuê.

Phạm vi CMS:

- `ContentPage`: trang giới thiệu, chính sách, hướng dẫn, FAQ.
- `ContentPost`: bài viết/blog, category/tag, draft/published/scheduled.
- `Banner`: vị trí hiển thị, desktop/mobile, thời gian, link và trạng thái.
- `MediaAsset`: file, metadata, alt text, folder/tag và quyền sử dụng.
- `ContentRevision`: version, người sửa, preview, publish/unpublish và rollback.
- SEO metadata: slug, title, description, canonical, social image, redirect.

Phạm vi PIM cho product:

- mô tả, gallery, thông số, phụ kiện đi kèm, hướng dẫn sử dụng, nội dung SEO và trạng thái publish.
- có thể gắn product với content block, nhưng giá, serial, availability, maintenance và allocation vẫn thuộc domain product/asset/rental.

Kiến trúc ban đầu: giữ model metadata trong PostgreSQL/Prisma; file ảnh/video đưa lên S3/R2 hoặc object storage, không lưu binary lớn trong PostgreSQL. Chưa cần page builder kéo-thả hoặc MongoDB; dùng block/schema có kiểm soát để dễ version và validate.

Tiêu chí hoàn thành:

- Có draft/preview/publish, revision/audit và phân quyền content riêng.
- Xóa/ẩn nội dung không làm mất dữ liệu order, contract, payment hoặc asset.

### P6 — Mở rộng sau khi core ổn định

Các chức năng có giá trị nhưng chưa nên đưa vào MVP:

- hóa đơn điện tử và tích hợp nhà cung cấp;
- đối soát ngân hàng tự động;
- tracking/GPS shipper và ứng dụng shipper;
- portal cho chủ máy và portal cho khách hàng;
- quản lý ca làm nhân viên;
- Meta Ads, SEO/Blog nâng cao, marketing automation;
- photo booth và các loại tài sản đặc thù;
- forecast nâng cao, multi-store, đa tiền tệ, thuế phức tạp;
- online payment gateway hoặc checkout tự phục vụ.

## 5. Quyền và module dự kiến

Các permission mới nên đặt theo resource/action, không cấp quyền chỉ vì người dùng nhìn thấy menu:

| Resource | Permission gợi ý |
|---|---|
| Dashboard | `dashboard.read` |
| Reports | `reports.read`, `reports.export` |
| Observability | `api_logs.read`, `audit_logs.read`, `audit_logs.export` |
| Availability | `availability.read`, `availability.create_booking` |
| Delivery | `deliveries.read`, `deliveries.manage`, `deliveries.assign`, `deliveries.confirm` |
| Contract | `contracts.read`, `contracts.manage`, `contracts.issue`, `contracts.send`, `contracts.sign` |
| Voucher | `vouchers.read`, `vouchers.manage`, `vouchers.apply_override` |
| Contributor | `contributors.read`, `contributors.manage`, `ownerships.manage` |
| Settlement | `settlements.read`, `settlements.calculate`, `settlements.approve`, `payouts.manage` |
| Finance/Expense | `finance.read`, `payments.manage`, `refunds.manage`, `expenses.manage` |
| CMS | `content.read`, `content.manage`, `content.publish`, `media.manage` |

Permission thực tế phải được thêm đồng thời ở backend seed/guard và frontend constants/sidebar. Không mở route chỉ bằng cách thêm item vào sidebar.

## 6. Luồng nghiệp vụ mục tiêu

```text
Xem lịch hiện tại
  → chọn khoảng trống / sản phẩm / serial
  → quote và áp voucher
  → tạo đơn
  → phát hành hợp đồng
  → phân công giao nhận (nếu có)
  → nhận payment/cọc và duyệt
  → bàn giao + checklist
  → đang thuê / theo dõi quá hạn
  → nhận trả + inspection/incident
  → tính late/damage/refund
  → hoàn tất payment và order
  → phân bổ doanh thu theo asset
  → preview/duyệt settlement
  → payout cho contributor
  → report/ROI/audit
```

Luồng kiểm thử xuyên suốt ưu tiên số một là: tạo contributor → gán asset → tạo đơn từ lịch → áp voucher (nếu có) → bàn giao/trả → ghi nhận charge/payment/refund → tính settlement preview → duyệt → tạo payout. Nếu luồng này còn phải dùng Excel để sửa số, chưa nên đầu tư CMS hoặc forecast nâng cao.

## 7. Phụ thuộc và thứ tự release

| Release | Phụ thuộc bắt buộc | Kết quả cần bàn giao |
|---|---|---|
| P0 | Auth/RBAC, logger, Prisma hiện tại | Trace request, audit mutation, permission matrix |
| P1 | Availability, rental order, payment schema | Rental flow hoàn chỉnh và worklist |
| P2 | P1 ổn định | Voucher, delivery, contract gắn được vào order |
| P3 | P1 + charge/payment + asset allocation | Contributor, ownership, settlement và payout preview |
| P4 | P1/P3 có dữ liệu tin cậy | Finance/report/export/ROI |
| P5 | Catalog ổn định và object storage | CMS/PIM có revision/publish |
| P6 | Vận hành và chính sách đã chốt | Tích hợp, portal và automation nâng cao |

## 8. Các quyết định cần chốt trước khi triển khai schema

1. Công thức chia: earned revenue hay cash collected, các loại phí nào được chia/khấu trừ.
2. Quyền sở hữu: một asset có nhiều contributor không, ownership thay đổi giữa kỳ xử lý thế nào.
3. Vai trò giao nhận: shipper nội bộ, đối tác hay cả hai; bằng chứng giao/nhận bắt buộc ở mức nào.
4. Hợp đồng: PDF template nội bộ đã đủ hay cần e-sign có giá trị pháp lý; trường dữ liệu giấy tờ nào được phép lưu.
5. Voucher: có cộng dồn không, áp vào tiền thuê hay cả phí khác, ai chịu phần discount khi chia doanh thu.
6. Retention: thời gian giữ API log, audit, contract document, ảnh bàn giao và dữ liệu cá nhân.
7. CMS: chỉ block có schema hay page builder; kênh public nào sẽ đọc content API.
8. Báo cáo: timezone, kỳ doanh thu, quy tắc hủy/hoàn và định nghĩa utilization/ROI.

## 9. Ngoài phạm vi của bản nâng cấp đầu tiên

- Không đưa online checkout/payment gateway vào khi admin-first manual payment chưa ổn định.
- Không dùng CMS để sửa trạng thái serial, booking, payment hoặc settlement.
- Không tạo MongoDB riêng chỉ vì cần xem log API.
- Không gọi số tiền đã thu là doanh thu nếu chưa qua định nghĩa charge/revenue.
- Không phát hành settlement/payout tự động trước khi có approval, adjustment và audit.

## Tài liệu liên quan

- [Product roadmap](../roadmap.md)
- [Implementation plan Phase 1](./implementation-plan.md)
- [Project overview](../../00-start-here/project-overview.md)
- [Database schema](../../02-architecture/database-schema.md)
- [Operations dashboard](../../03-domains/dashboard/operations-dashboard.md)
- [Daily worklist](../../03-domains/rental-orders/daily-worklist.md)
- [Audit log plan](../../03-domains/rental-orders/audit-log-plan.md)
- [Frontend conventions](../../04-applications/frontend/conventions.md)
- [Backend conventions](../../04-applications/backend/conventions.md)
