import { Injectable, Logger } from '@nestjs/common';
import { SocketGateway } from './socket.gateway';
import { IEmitToListUserIdDto, IEmitToUserIdDto } from '@/libs/types/socket.type';

@Injectable()
export class SocketService {
  private readonly logger = new Logger(SocketService.name);

  constructor(private readonly socketGateway: SocketGateway) {}

  sendToUser(payload: IEmitToUserIdDto): void {
    const server = this.socketGateway.getServer();

    if (!server) {
      this.logger.warn('Cannot emit socket event: Socket.io server has not started.');
      return;
    }

    const { userId, eventName, data } = payload;
    const roomName = `user:${userId}`;
    server.to(roomName).emit(eventName, data);
    this.logger.log(`Emitted "${eventName}" to room: ${roomName}`);
  }

  sendToUsers(payload: IEmitToListUserIdDto): void {
    const { userIds, eventName, data } = payload;
    userIds.forEach((userId) => {
      this.sendToUser({ userId, eventName, data });
    });
  }
}
