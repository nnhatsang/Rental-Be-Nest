import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { SocketGateway } from './socket.gateway';
import { SocketService } from './socket.service';

@Global() // Đánh dấu Global để các module khác sử dụng trực tiếp SocketService không cần import lại
@Module({
  imports: [JwtModule.register({})],
  providers: [SocketGateway, SocketService],
  exports: [SocketService],
})
export class SocketModule {}
