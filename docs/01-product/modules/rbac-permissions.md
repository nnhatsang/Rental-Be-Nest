# Mô-đun Nghiệp vụ: Phân quyền nội bộ (RBAC & User Directory Module)

> Tài liệu mô tả yêu cầu sản phẩm cho tính năng quản lý tài khoản nhân viên, thiết lập vai trò và kiểm soát phân quyền vận hành hệ thống.

---

## 1. Màn hình quản lý nhân viên (`/users`)

Màn hình này chỉ dành riêng cho tài khoản có quyền quản trị viên (`users.read`, `users.create`, `users.update`, `users.delete`).

### Yêu cầu chức năng:
- **Danh sách nhân sự**: Hiển thị bảng danh sách nhân viên nội bộ kèm theo email, tên, số điện thoại, trạng thái tài khoản (`ACTIVE`, `BANNED`, `LOCKED`, `INACTIVE`) và vai trò được gán (ví dụ: Thủ kho, Quản lý).
- **Thêm nhân viên mới**: Form nhập tên, email, số điện thoại và gán vai trò ban đầu. Hệ thống tự động gửi email kích hoạt tài khoản kèm mật khẩu mặc định.
- **Khóa tài khoản**: Hỗ trợ chuyển trạng thái nhân viên sang `BANNED` hoặc `INACTIVE` để thu hồi quyền truy cập hệ thống ngay lập tức khi nhân viên nghỉ việc hoặc vi phạm quy chế.
- **Reset mật khẩu**: Admin có thể kích hoạt tính năng gửi email đặt lại mật khẩu cho nhân viên.

---

## 2. Màn hình cấu hình vai trò & Quyền hạn (`/roles`)

Hệ thống cho phép admin xem và điều chỉnh các quyền hạn động được gán cho từng vai trò vận hành.

### Yêu cầu chức năng:
- **Danh sách vai trò**: Xem danh sách vai trò hệ thống (Admin, Manager, Staff, Viewer) và các vai trò tự cấu hình thêm nếu có.
- **Phân bổ quyền (Permission Grid)**: Giao diện bảng lưới check/uncheck các quyền hạt mịn (orders, customers, products, assets, users, reports, settings) cho từng vai trò.
- **Cờ bảo vệ hệ thống (`isSystem`)**: Ngăn chặn hành động xóa hoặc đổi tên đối với các vai trò mặc định của hệ thống để tránh làm sập luồng phân quyền cơ bản.

---

## 3. Quy trình xác thực quyền truy cập API

Mọi tương tác từ ứng dụng Frontend Admin Console lên Backend API đều phải qua kiểm soát phân quyền tự động:

```text
Request gửi lên kèm Cookie
  ↳ JWT Guard: Giải mã token, kiểm tra chữ ký & thời hạn -> Xác định User ID
    ↳ User Status Check: Kiểm tra trạng thái tài khoản có phải ACTIVE không?
      ↳ Load Permissions: Truy vấn database lấy danh sách mã quyền của User
        ↳ Permission Guard: Đối chiếu mã quyền của route với quyền User sở hữu
          ↳ 200 OK (Chấp nhận) / 403 Forbidden (Từ chối)
```
- Các lỗi xác thực hoặc thiếu quyền bắt buộc phải trả về mã HTTP tương ứng (`401 Unauthorized` hoặc `403 Forbidden`) kèm mã lỗi nghiệp vụ chuẩn hóa để Frontend hiển thị thông báo toast phù hợp.

---

## 4. Đồng bộ quyền hạn thời gian thực (Real-time Permission Sync UX)

Để tối ưu hóa trải nghiệm người dùng (UX) và bảo mật vận hành, khi admin thay đổi quyền hạn hoặc trạng thái tài khoản của nhân viên, hệ thống cần đáp ứng các tiêu chí sau:

### 4.1 Thông báo nhẹ trong ứng dụng (Toast Alerts)
- Khi nhân viên đang mở ứng dụng và bị thay đổi vai trò/quyền hạn, hệ thống sẽ hiện một thông báo toast loại `info` ở góc màn hình: `"Quyền hạn của bạn đã được cập nhật bởi quản trị viên."`
- Hệ thống ngầm gửi API cập nhật quyền mà không ngắt quãng công việc hiện tại của nhân viên (không ép buộc tải lại trang gây mất dữ liệu form đang nhập dở).

### 4.2 Đăng xuất cưỡng bức (Forced Logout)
- Trong trường hợp nhân viên bị admin khóa tài khoản (`BANNED`, `LOCKED` hoặc chuyển sang `INACTIVE`):
  - Phía Frontend nhận tín hiệu socket sẽ lập tức xóa sạch token trong cookie, xóa cache session.
  - Ép buộc chuyển hướng nhân viên ra màn hình đăng nhập `/auth/login` ngay lập tức.
  - Hiển thị thông báo toast loại `error` lỗi bảo mật: `"Tài khoản của bạn đã bị khóa hoặc ngừng hoạt động. Vui lòng liên hệ Admin."`

