# Kiến trúc Đồng bộ Phân quyền thời gian thực (Real-time RBAC Sync)

> Tài liệu đặc tả kỹ thuật chi tiết cơ chế sử dụng WebSockets để tự động cập nhật quyền hạn và trạng thái của người dùng mà không cần reload trình duyệt.

---

## 1. Cơ chế Xác thực kết nối Handshake (Socket Authentication)

Để đảm bảo an ninh, kết nối WebSocket chỉ được chấp nhận đối với các tài khoản nhân sự nội bộ đã đăng nhập thành công.

### Quy trình Handshake:
1. Trình duyệt client khởi tạo kết nối Socket.io lên server. Do Access Token được lưu trữ trong Cookie `HttpOnly` dạng `admin_access_token`, trình duyệt sẽ tự động gửi kèm cookie này trong request handshake WebSocket.
2. Tại Backend NestJS, Gateway sử dụng một Custom Guard hoặc xử lý trực tiếp tại hook `handleConnection(client: Socket)` để giải mã cookie:
   - Đọc cookie `admin_access_token`.
   - Sử dụng `JwtService` giải mã và kiểm tra thời hạn của token.
   - Nếu token không hợp lệ hoặc hết hạn, ngắt kết nối socket ngay lập tức (`client.disconnect(true)`).
   - Nếu hợp lệ, gán thông tin người dùng (`user`) vào object socket (`client.data.user = decodedPayload`).

---

## 2. Quản lý phòng sự kiện (Room-based Subscriptions)

Để gửi tin nhắn thông báo chính xác tới từng người dùng cụ thể, chúng ta sử dụng cơ chế **Room (Phòng)** của Socket.io.

### Cách thức hoạt động:
- Ngay sau khi handshake thành công, server tự động đưa socket connection của client vào phòng có định danh dựa trên ID của người dùng:
  ```typescript
  const userId = client.data.user.id;
  client.join(`user:${userId}`);
  ```
- Một người dùng đăng nhập trên nhiều thiết bị hoặc tab trình duyệt khác nhau sẽ tương ứng với nhiều kết nối socket, nhưng tất cả các kết nối này đều tham gia chung vào phòng `user:<userId>`.

---

## 3. Cơ chế Kích hoạt Sự kiện ở Backend (Event Dispatchers)

Mọi thay đổi về phân quyền và vai trò đều được kích hoạt thông qua các API HTTP thông thường. Khi nghiệp vụ cập nhật cơ sở dữ liệu PostgreSQL thành công, backend sẽ phát sự kiện thông báo qua WebSocket Gateway.

### Trường hợp 1: Cập nhật Vai trò của Người dùng (`PATCH /api/users/:id/roles`)
Khi vai trò của nhân viên có `userId = X` bị thay đổi:
1. Lưu vai trò mới vào bảng `UserRole`.
2. Trích xuất socket gateway và gửi sự kiện đến phòng tương ứng:
   ```typescript
   this.socketGateway.server.to(`user:${X}`).emit('permissions:updated', {
     reason: 'User roles updated by administrator',
   });
   ```

### Trường hợp 2: Cập nhật Quyền của Vai trò (`PUT /api/roles/:id/permissions`)
Khi quyền hạn của vai trò `Role = Y` bị thay đổi (ảnh hưởng đến toàn bộ nhân viên đang giữ vai trò này):
1. Cập nhật bảng `RolePermission`.
2. Truy vấn DB tìm tất cả các `userId` đang sở hữu `roleId = Y`. Gọi tập hợp này là `userIds`.
3. Gửi sự kiện đồng loạt tới các phòng tương ứng:
   ```typescript
   userIds.forEach((userId) => {
     this.socketGateway.server.to(`user:${userId}`).emit('permissions:updated', {
       reason: 'Role permissions updated by administrator',
     });
   });
   ```

---

## 4. Xử lý sự kiện ở Frontend Client (React / Next.js)

### 4.1 Khởi tạo kết nối (`SocketProvider`)
Frontend duy trì một kết nối socket duy nhất toàn cục. Khi người dùng đăng nhập thành công, socket client sẽ tự động kết nối và gửi kèm cookie xác thực.

### 4.2 Lắng nghe và làm mới dữ liệu (Refetch Flow)
Sử dụng custom hook lắng nghe sự kiện `permissions:updated` tại Root Layout hoặc Sidebar Shell:

```typescript
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { socket } from '@/lib/socket'; // client socket instance
import { toast } from 'sonner';

export function useRealtimeRbacSync() {
  const queryClient = useQueryClient();

  useEffect(() => {
    // Lắng nghe sự kiện từ server
    socket.on('permissions:updated', (data) => {
      // 1. Hiển thị thông báo nhẹ cho người dùng
      toast.info('Quyền hạn của bạn đã được cập nhật bởi quản trị viên.');

      // 2. Refresh lại cache React Query của API lấy thông tin người dùng
      // API: GET /api/admin/auth/me
      queryClient.invalidateQueries({
        queryKey: ['auth', 'me'],
      });
    });

    return () => {
      socket.off('permissions:updated');
    };
  }, [queryClient]);
}
```

- Khi React Query invalidates query `['auth', 'me']`, một request HTTP `GET /api/admin/auth/me` mới sẽ tự động gửi lên backend để lấy lại danh sách permissions mới.
- UI React sẽ tự động re-render, ẩn hoặc hiện các nút chức năng và menu sidebar tương ứng với quyền mới ngay lập tức.
