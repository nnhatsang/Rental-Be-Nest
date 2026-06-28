import { OnGatewayConnection, OnGatewayDisconnect, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { AUTH_ACCESS_COOKIE } from '../auth/auth.constants';
import { JwtAccessPayload } from '../auth/types/auth-user.type';

@WebSocketGateway({
  cors: {
    origin: true, // Cho phép động theo origin của client
    credentials: true, // Bắt buộc để truyền Cookie HttpOnly
  },
})
export class SocketGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(SocketGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      this.logger.log(`Client đang thử kết nối: ${client.id}`);

      // 1. Lấy cookie từ headers handshake
      const cookieHeader = client.handshake.headers.cookie;
      if (!cookieHeader) {
        this.logger.warn(`Kết nối bị từ chối: Không tìm thấy cookie trong handshake headers.`);
        client.disconnect(true);
        return;
      }

      // 2. Phân tích cookie để tìm admin_access_token
      const token = cookieHeader
        .split('; ')
        .find((row) => row.startsWith(`${AUTH_ACCESS_COOKIE}=`))
        ?.split('=')[1];

      if (!token) {
        this.logger.warn(`Kết nối bị từ chối: Không tìm thấy cookie ${AUTH_ACCESS_COOKIE}.`);
        client.disconnect(true);
        return;
      }

      // 3. Giải mã và xác thực token JWT
      const secret = this.configService.getOrThrow<string>('JWT_ACCESS_SECRET');
      const payload: JwtAccessPayload = await this.jwtService.verifyAsync(token, {
        secret,
      });

      if (!payload || payload.type !== 'access') {
        this.logger.warn(`Kết nối bị từ chối: Token không hợp lệ hoặc sai loại (type).`);
        client.disconnect(true);
        return;
      }

      // 4. Lưu thông tin user vào socket instance
      client.data.user = payload;

      // 5. Đăng ký client vào phòng (room) định danh theo userId
      const userId = payload.sub; // sub là userId trong JwtAccessPayload
      await client.join(`user:${userId}`);

      this.logger.log(`Client kết nối thành công: ${client.id} (User: ${userId})`);
    } catch (err) {
      this.logger.error(`Lỗi trong quá trình handshake connection: ${err.message}`);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client đã ngắt kết nối: ${client.id}`);
  }
}
