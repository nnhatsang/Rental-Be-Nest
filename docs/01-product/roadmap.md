# Roadmap & Checklist công việc (Product Roadmap)

> Tài liệu theo dõi tiến độ phát triển và kế hoạch ra mắt các tính năng của hệ thống Rental Admin qua các giai đoạn (Phases).

---

## 🧭 Thứ tự ưu tiên phát triển (Phases)

```text
Phase 0 (Thiết lập nền tảng)
  → Phase 1 (Xác thực Auth & Phân quyền RBAC)
  → Phase 2 (Quản lý Khách hàng & Kho thiết bị)
  → Phase 3 (Vòng đời Đơn thuê & Kiểm tra lịch trống)
  → Phase 4 (Biên bản Bàn giao & Nhận trả máy)
  → Phase 5 (Ghi nhận Thanh toán thủ công)
  → Phase 6 (Báo cáo thống kê & Quyết toán)
```

---

## 🏁 Trạng thái chi tiết từng Phase

### Phase 0 — Thiết lập nền tảng ✅ (Hoàn thành)
- [x] Thiết kế Database Schema đầy đủ (Prisma schema + PostgreSQL).
- [x] Cấu hình môi trường chạy cục bộ Docker + Docker Compose.
- [x] Khởi tạo dự án Backend NestJS và cấu hình biên dịch SWC.
- [x] Khởi tạo dự án Frontend Next.js (App Router) với Shadcn UI.
- [x] Setup cơ chế Soft Delete mặc định và cấu hình Index.

### Phase 1 — Xác thực Auth & Phân quyền RBAC ⏳ (Đang hoàn thiện)
- [x] Backend: Viết Auth module (đăng nhập, đổi mật khẩu, refresh token qua cookie HttpOnly).
- [x] Backend: Xây dựng cơ chế JwtStrategy & PermissionGuard kiểm tra mã quyền động.
- [x] Frontend: Form đăng nhập admin và lưu trữ thông tin session cá nhân.
- [ ] Frontend: Quản lý nhân viên (`/users`) và gán vai trò (`/roles`).

### Phase 2 — Khách hàng & Kho thiết bị ✅ (Hoàn thành)
- [x] Backend: API CRUD danh mục sản phẩm (`Product`), thương hiệu (`Brand`), nhóm (`ProductCategory`).
- [x] Backend: API quản lý biểu giá bậc thang (`ProductRentalPriceTier`).
- [x] Backend: API quản lý từng thiết bị vật lý cụ thể theo Serial (`AssetUnit`).
- [x] Backend: Tích hợp tìm kiếm tiếng Việt không dấu (Accent-insensitive) sử dụng chỉ mục trigram GIN.
- [x] Frontend: Trang quản lý sản phẩm, thiết bị, và tạo nhanh khách hàng.

### Phase 3 — Vòng đời Đơn thuê & Kiểm tra lịch trống ⏳ (Đang phát triển)
- [x] Backend: Thuật toán quét trùng lịch giao thoa thời gian (Time Overlap checking) có tính đến turnaround minutes.
- [x] Backend: API tạo đơn hàng nháp (`DRAFT`) và gán thiết bị cụ thể.
- [ ] Frontend: Màn hình kiểm tra lịch trống khả dụng (`/availability`) thời gian thực.
- [ ] Frontend: Màn hình tạo đơn hàng mới theo từng bước (Step-by-step order creation).

### Phase 4 — Biên bản Bàn giao & Kiểm tra ⏳ (Chưa bắt đầu)
- [ ] Backend: API tạo biên bản bàn giao (`OrderHandover`) khi giao máy và khi nhận trả máy.
- [ ] Backend: API kiểm tra thiết bị sau trả (`ReturnInspection`) và tạo báo cáo hư hỏng (`DamageReport`).
- [ ] Frontend: Biểu mẫu checklist tình trạng máy ảnh, phụ kiện khi nhận trả tại quầy.

### Phase 5 — Ghi nhận Thanh toán thủ công ⏳ (Chưa bắt đầu)
- [ ] Backend: API ghi nhận thu tiền cọc, tiền thuê (`PaymentRecord`) và hoàn trả tiền mặt/chuyển khoản.
- [ ] Frontend: Modal ghi nhận giao dịch tài chính nhanh trong trang chi tiết đơn hàng.

### Phase 6 — Báo cáo & Quyết toán ⏳ (Chưa bắt đầu)
- [ ] Backend: API tổng hợp doanh thu theo thời gian, lọc theo loại phí (thuê/trễ/hỏng).
- [ ] Frontend: Trang Dashboard tổng hợp các chỉ số vận hành chính (doanh thu, số đơn bận trong ngày, thiết bị đang bảo trì).
