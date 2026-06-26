# Hướng dẫn Lệnh phát triển (Developer CLI Commands)

> Tài liệu tổng hợp các lệnh phát triển thường dùng trong quá trình lập trình, kiểm thử kiểu dữ liệu và vận hành hệ thống Rental Admin ở môi trường cục bộ (Local Development).

---

## 1. Các lệnh phát triển Backend (NestJS API)

Chạy các lệnh này tại thư mục gốc của repo backend (`rental-admin-be`).

### 1.1 Quản lý Cơ sở dữ liệu (Prisma Commands)

- **Sinh Prisma Client**: Cập nhật TypeScript definition cho Prisma Client sau khi thay đổi schema.
  ```bash
  pnpm prisma generate
  ```
- **Xác thực Schema**: Kiểm tra tính hợp lệ về cú pháp và mối liên kết trong schema file.
  ```bash
  pnpm prisma validate
  ```
- **Định dạng file Schema**: Tự động định dạng căn lề file `schema.prisma`.
  ```bash
  pnpm prisma format
  ```
- **Tạo và chạy bản Migration mới**: Dùng khi thêm/sửa/xóa cột hoặc bảng trong DB.
  ```bash
  pnpm prisma migrate dev
  ```
- **Reset Database**: Xóa sạch toàn bộ bảng dữ liệu hiện có và chạy lại toàn bộ migration từ đầu (Lưu ý: Thao tác này sẽ làm mất sạch dữ liệu dev hiện tại).
  ```bash
  pnpm prisma migrate reset
  ```

### 1.2 Khởi chạy ứng dụng và build
- **Chạy ứng dụng Watch mode**: Chạy backend ở chế độ lập trình, tự động reload khi sửa code (Sử dụng SWC compiler để reload siêu tốc).
  ```bash
  pnpm start:dev
  ```
- **Kiểm tra kiểu dữ liệu TypeScript**: Kiểm tra lỗi biên dịch TypeScript tĩnh độc lập (Khuyến nghị chạy trước khi commit).
  ```bash
  pnpm typecheck
  ```
- **Biên dịch ứng dụng (Build)**: Tạo bản build NestJS production trong thư mục `dist/`.
  ```bash
  pnpm build
  ```

---

## 2. Các lệnh phát triển Frontend (Next.js Console)

Chạy các lệnh này tại thư mục gốc của repo frontend (`rental-admin-fe`).

- **Chạy Server phát triển**: Khởi chạy Next.js Local Server ở Watch mode.
  ```bash
  pnpm dev
  ```
- **Kiểm tra kiểu dữ liệu TypeScript**: Kiểm tra lỗi kiểu tĩnh cho toàn bộ mã nguồn Next.js (bắt buộc chạy trước khi commit code).
  ```bash
  pnpm exec tsc --noEmit
  ```
- **Biên dịch ứng dụng (Build)**: Tạo bản đóng gói tối ưu hóa cho môi trường Production.
  ```bash
  pnpm build
  ```
- **Khởi chạy ứng dụng production cục bộ**: Chạy server Next.js sau khi đã build thành công.
  ```bash
  pnpm start
  ```
