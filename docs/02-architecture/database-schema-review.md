# Đánh giá Database Schema & Tiến độ Phases

> Tài liệu ghi nhận kết quả rà soát schema, các điểm cần lưu ý, và tiến độ triển khai từng Phase.

---

## 1. Đánh giá chung

Schema ở mức **production-ready cho Phase 1**. Cấu trúc bảng, quan hệ, snapshot pattern, tài chính, index, và audit trail đều được thiết kế đúng và đủ.

---

## 2. Các điểm cần lưu ý / cải thiện

### 2.1 Docs lệch với schema thực tế (cần cập nhật docs)

**`AssetStatus` enum**

`database-schema.md` mô tả: `AVAILABLE`, `RENTED`, `MAINTENANCE`, `DAMAGED`.

Schema thực tế (`schema.prisma`):
```
AVAILABLE / RESERVED / RENTED / MAINTENANCE / RETIRED / LOST
```
Không có `DAMAGED`. Cần cập nhật docs để khớp — đặc biệt `RESERVED` là trạng thái quan trọng khi đơn được `CONFIRMED`.

**`AssetCondition` enum**

Docs mô tả: `GOOD`, `SCRATCHED`, `BROKEN`.

Schema thực tế:
```
NEW / GOOD / FAIR / DAMAGED / LOST
```
Tên enum thay đổi hoàn toàn. Cần cập nhật lại docs.

**`CustomerStatus` enum**

Docs dùng tên `BLACKLISTED`, schema dùng `BLOCKED`. Cần thống nhất — nên giữ `BLOCKED` vì đó là tên trong schema.

**Công thức availability check trong `business-requirements.md`**

Hiện tại docs viết:
```
existing.startDate < new.endDate AND existing.endDate > new.startDate
```
Công thức đúng theo thiết kế schema phải dùng `blockedEndDate`:
```
existing.startDate < new.blockedEndDate AND existing.blockedEndDate > new.startDate
```
Cần sửa lại công thức trong `business-requirements.md` và `availability-rules.md`.

---

### 2.2 Vấn đề thiết kế cần xem xét

**`ReturnInspection.inspectedById` thiếu relation**

```prisma
inspectedById String @db.Uuid
// Không có: inspector User @relation(...)
```
Field này lưu UUID người kiểm tra nhưng không có Prisma relation về `User`. Khi query cần tra cứu thông tin người kiểm tra phải tự join thủ công. Nên thêm:
```prisma
inspectedById String @db.Uuid
inspector     User   @relation(fields: [inspectedById], references: [id])
```

**`OrderHandover` thiếu field `handledById`**

Model có comment `/// Admin/staff handling the handover` nhưng không có field tương ứng — chỉ có `createdBy` (audit). Nếu người thực hiện bàn giao thực tế có thể khác người tạo record thì cần thêm `handledById String? @db.Uuid` + relation về `User`.

**`RentalPolicy` không có soft delete — cần ghi chú lý do**

`deletedAt` bị comment out trong schema. Đây có thể là chủ đích (policy chỉ tạo mới, không bao giờ xóa), nhưng không có ghi chú giải thích. Nên thêm comment vào schema:
```prisma
// Soft delete không áp dụng cho RentalPolicy.
// Policy chỉ được tạo mới (code = DEFAULT, CUSTOM...), không xóa.
// Order đã áp dụng policy nào thì giữ nguyên snapshot turnaroundMinutes.
```

---

## 3. Tiến độ triển khai theo Phase

### Phase 0 — Thiết lập nền tảng ✅ Hoàn thành

- [x] Prisma schema đầy đủ, migrate và generate thành công.
- [x] Docker Compose cho PostgreSQL + Redis.
- [x] NestJS project khởi tạo với SWC compiler.
- [x] Soft delete + GIN trigram index cấu hình sẵn.
- [x] Seeder tạo permissions, roles, admin mặc định, rental policy, store business hours.

---

### Phase 1 — Auth & RBAC ⏳ Gần hoàn thành (Backend xong, Frontend còn 1 việc)

**Backend ✅ Hoàn thành**
- [x] `auth` module: login, logout, refresh token, forgot/reset password qua email.
- [x] `JwtStrategy` (access + refresh) với cookie HttpOnly.
- [x] `PermissionGuard` kiểm tra mã quyền động từ DB.
- [x] `users` module: CRUD, đổi trạng thái, gán role, reset password.
- [x] `roles` module: CRUD role, gán/thu hồi permission.
- [x] `permissions` module: list permissions.
- [x] `mail` module: gửi email reset password.

**Frontend ⏳ Còn 1 hạng mục**
- [x] Form đăng nhập, session management.
- [ ] Trang quản lý nhân viên `/users` và gán vai trò `/roles`.

---

### Phase 2 — Khách hàng & Kho thiết bị ✅ Hoàn thành

**Backend ✅**
- [x] `customers` module: CRUD, cập nhật trạng thái (BLOCKED), tìm kiếm không dấu.
- [x] `products` module: CRUD product, brand, category, biểu giá bậc thang `ProductRentalPriceTier`.
- [x] `asset-units` module: CRUD, cập nhật trạng thái/tình trạng máy, tìm kiếm không dấu.
- [x] `rental-policy` module: đọc và cập nhật policy.
- [x] `store-business-hours` module: cấu hình giờ mở cửa theo thứ trong tuần.
- [x] `store-closure` module: CRUD lịch nghỉ/đóng cửa.

**Frontend ✅** (theo roadmap)
- [x] Trang quản lý sản phẩm, thiết bị, tạo nhanh khách hàng.

---

### Phase 3 — Vòng đời Đơn thuê & Kiểm tra lịch trống ⏳ Đang phát triển

**Backend ✅ Core xong**
- [x] Thuật toán overlap check có tính `turnaroundMinutes` + `blockedEndDate`.
- [x] `POST /rental-orders/check-availability` — kiểm tra lịch trống.
- [x] `POST /rental-orders` — tạo đơn nháp (`DRAFT`).
- [x] `PATCH /rental-orders/:id/items/assign-assets` — gán serial vào đơn.
- [x] `POST /rental-orders/:id/confirm` — xác nhận đơn (`DRAFT` → `CONFIRMED`).
- [x] `POST /rental-orders/:id/cancel` — hủy đơn.
- [x] `PATCH /rental-orders/:id` — sửa đơn nháp.
- [x] `GET /rental-orders` + `GET /rental-orders/:id` — danh sách và chi tiết đơn.

**Backend ⏳ Chưa có**
- [ ] Chuyển trạng thái `CONFIRMED` → `PREPARING` → `READY_FOR_PICKUP`/`DELIVERING` → `RENTING`.
- [ ] Cron job hoặc trigger tự động chuyển sang `OVERDUE` khi quá `endDate`.
- [ ] Socket/realtime notify khi trạng thái đơn thay đổi (module `socket` đã khởi tạo).

**Frontend ⏳ Chưa bắt đầu**
- [ ] Màn hình kiểm tra lịch trống `/availability`.
- [ ] Màn hình tạo đơn từng bước (step-by-step).

---

### Phase 4 — Biên bản Bàn giao & Kiểm tra trả máy ⏳ Chưa bắt đầu

- [ ] Backend: `POST /rental-orders/:id/handover` — tạo biên bản bàn giao (`OrderHandover` loại `OUTBOUND`).
- [ ] Backend: `POST /rental-orders/:id/return-handover` — nhận trả máy (`OrderHandover` loại `RETURN`).
- [ ] Backend: `POST /rental-orders/:id/return-inspection` — kiểm tra máy sau trả (`ReturnInspection` + `DamageReport`).
- [ ] Backend: Tự động cập nhật `AssetUnit.status` → `AVAILABLE` / `MAINTENANCE` / `DAMAGED` sau kiểm tra.
- [ ] Frontend: Biểu mẫu checklist tình trạng máy, phụ kiện khi nhận trả.

---

### Phase 5 — Ghi nhận Thanh toán thủ công ⏳ Chưa bắt đầu

- [ ] Backend: `POST /rental-orders/:id/payments` — ghi nhận thu tiền (`DEPOSIT`, `RENTAL_FEE`, `LATE_FEE`, `DAMAGE_FEE`).
- [ ] Backend: `POST /rental-orders/:id/payments/refund` — ghi nhận hoàn tiền.
- [ ] Backend: Tự động tính lại `paidTotal`, `remainingTotal`, `refundTotal` sau mỗi `PaymentRecord`.
- [ ] Backend: Cập nhật `paymentStatus` (`UNPAID` → `PARTIALLY_PAID` → `PAID` → `REFUNDED`).
- [ ] Frontend: Modal ghi nhận giao dịch nhanh trong trang chi tiết đơn.

---

### Phase 6 — Báo cáo & Quyết toán ⏳ Chưa bắt đầu

- [ ] Backend: API tổng hợp doanh thu theo khoảng thời gian, phân loại theo `PaymentKind`.
- [ ] Backend: API thống kê thiết bị (đang bận, đang bảo trì, số lượt thuê).
- [ ] Backend: API thống kê đơn hàng (đang thuê, quá hạn, hoàn tất trong ngày/tuần/tháng).
- [ ] Frontend: Dashboard tổng hợp các chỉ số vận hành chính.

---

## 4. Tóm tắt tiến độ

| Phase | Phạm vi | Backend | Frontend | Tổng thể |
|---|---|:---:|:---:|:---:|
| 0 | Nền tảng | ✅ | ✅ | ✅ Xong |
| 1 | Auth & RBAC | ✅ | ⏳ | ⏳ ~85% |
| 2 | Khách hàng & Kho | ✅ | ✅ | ✅ Xong |
| 3 | Đơn thuê & Lịch | ⏳ | ❌ | ⏳ ~50% |
| 4 | Bàn giao & Kiểm tra | ❌ | ❌ | ❌ 0% |
| 5 | Thanh toán thủ công | ❌ | ❌ | ❌ 0% |
| 6 | Báo cáo & Quyết toán | ❌ | ❌ | ❌ 0% |
