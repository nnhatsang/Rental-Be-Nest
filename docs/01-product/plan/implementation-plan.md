# Kế hoạch triển khai Phase 1 (Phase 1 Implementation Plan)

> Tài liệu mô tả lộ trình kỹ thuật, các mốc quan trọng (Milestones) và kế hoạch triển khai xây dựng hệ thống Rental Admin Phase 1.

---

## 1. Các mốc triển khai chính (Milestones)

Lộ trình triển khai Phase 1 được phân chia thành 4 cột mốc chính nhằm đảm bảo tính ổn định và tính liên tục của hệ thống:

```text
Mốc 1: Khởi tạo & Phân quyền (RBAC Setup)
  ↳ Mốc 2: Danh mục & Quản lý Kho (Inventory CRUD)
    ↳ Mốc 3: Tạo đơn & Quét trùng lịch (Orders & Overbooking)
      ↳ Mốc 4: Biên bản bàn giao & Tất toán (Handover & Return)
```

---

## 2. Chi tiết kỹ thuật từng bước triển khai

### Bước 1: Khởi tạo database & cấu hình Phân quyền (RBAC)
- Chạy migrate database tạo các bảng Phân quyền (`User`, `Role`, `Permission`, `UserRole`, `RolePermission`).
- Hoàn thiện module Auth ở backend và trang đăng nhập phía frontend Next.js.
- Viết file seed tự động nạp danh sách quyền cơ bản và tài khoản admin hệ thống mặc định.

### Bước 2: Thiết lập danh mục sản phẩm & quản lý kho hàng
- Xây dựng API CRUD cho `Product`, `ProductRentalPriceTier` và `AssetUnit`.
- Tích hợp chỉ mục GIN trigram index trên cột `searchText` ở PostgreSQL để hỗ trợ tìm kiếm tiếng Việt không dấu.
- Hoàn thiện giao diện danh sách sản phẩm, thêm mới sản phẩm và quản lý số Serial trên Admin Console.

### Bước 3: Phát triển luồng đơn thuê & cơ chế quét lịch trùng
- Hiện thực hóa thuật toán quét giao thoa thời gian (Overlap formula) ở backend để kiểm tra khả dụng của thiết bị.
- Phát triển API tạo đơn thuê nháp, gán Serial máy, và chuyển trạng thái sang `CONFIRMED`.
- Xây dựng giao diện xem lịch trống `/availability` và biểu mẫu tạo đơn hàng đa bước phía frontend.

### Bước 4: Hoàn thiện biên bản bàn giao, nhận trả và tất toán đơn hàng
- Xây dựng API lập biên bản `OrderHandover` và biên bản kiểm tra kỹ thuật `ReturnInspection` sau khi trả máy.
- Hoàn thiện module ghi nhận giao dịch tài chính thủ công (`PaymentRecord`).
- Xây dựng giao diện trang chi tiết đơn hàng admin, tích hợp các modal thao tác nhanh: bàn giao máy, nhận trả máy, kiểm tra hư hỏng, ghi nhận thu tiền cọc và hoàn cọc cho khách.

---

## 3. Kế hoạch tích hợp & Kiểm thử (Integration & Testing Plan)

### 3.1 Kiểm thử đơn vị (Unit & Integration Testing)
- **Backend API**: Viết các test case kiểm tra biên của thuật toán Overlap bận/rảnh thời gian (kiểm tra các tình huống thuê sát giờ nhau, turnaround minutes chồng lấn).
- **Phân quyền**: Viết test case giả lập gọi API của tài khoản `STAFF` và `VIEWER` để đảm bảo hệ thống chặn đúng lỗi `403 Forbidden` khi họ cố gắng thực hiện các thao tác ngoài quyền hạn cho phép.

### 3.2 Kiểm thử dòng nghiệp vụ (E2E Manual Testing)
- Nhân viên tạo đơn hàng nháp cho 1 máy Sony A7 IV SN001.
- Nhân viên bấm xác nhận đơn hàng (chuyển sang `CONFIRMED`).
- Mở tab khác kiểm tra khả dụng của máy SN001 trong cùng khoảng thời gian thuê trên -> Hệ thống phải báo bận và cấm gán vào đơn mới.
- Tiến hành đổi trạng thái đơn sang `RENTING` -> Kiểm tra tình trạng `AssetUnit` trong kho phải chuyển thành `RENTED`.
- Làm thủ tục nhận trả máy (`RETURNED`), lập biên bản ghi nhận máy trầy xước nhẹ -> Tạo Damage Report phạt tiền cọc khách hàng -> Ghi nhận thanh toán hoàn cọc -> Chuyển đơn sang `COMPLETED` -> Kiểm tra trạng thái máy quay lại `AVAILABLE` trong kho.
