import { Injectable, Logger } from '@nestjs/common';
import { SocketGateway } from './socket.gateway';
import { IEmitToListUserIdDto, IEmitToUserIdDto } from '@/libs/types/socket.type';

@Injectable()
export class SocketService {
  private readonly logger = new Logger(SocketService.name);

  constructor(private readonly socketGateway: SocketGateway) {}

  /**
   * Gửi sự kiện thời gian thực tới một người dùng cụ thể (tất cả các socket connection của họ)
   */
  sendToUser(payload: IEmitToUserIdDto): void {
    if (!this.socketGateway.server) {
      this.logger.warn(`Không thể gửi sự kiện socket: Socket.io server chưa khởi động.`);
      return;
    }

    const { userId, eventName, data } = payload;
    const roomName = `user:${userId}`;
    this.socketGateway.server.to(roomName).emit(eventName, data);
    this.logger.log(`Đã gửi sự kiện "${eventName}" tới phòng: ${roomName}`);
  }

  /**
   * Gửi sự kiện thời gian thực tới danh sách nhiều người dùng
   */
  sendToUsers(payload: IEmitToListUserIdDto): void {
    const { userIds, eventName, data } = payload;
    userIds.forEach((userId) => {
      this.sendToUser({ userId, eventName, data });
    });
  }
}
