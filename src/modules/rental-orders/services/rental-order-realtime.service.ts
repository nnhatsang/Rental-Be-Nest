import { Injectable } from '@nestjs/common';
import { EAvailabilityChangeReason, ESocketEmit } from '@/libs/enums/socket.enum';
import { SocketService } from '@/libs/socket/socket.service';

@Injectable()
export class RentalOrderRealtimeService {
  constructor(private readonly socketService: SocketService) {}

  emitAvailabilityChanged(reason: EAvailabilityChangeReason, items: Array<{ productId: string; assetUnitId?: string | null }>): void {
    const productIds = [...new Set(items.map((item) => item.productId))];
    this.socketService.broadcastToAdmins(ESocketEmit.AVAILABILITY_CHANGED, {
      reason,
      productIds,
      assetUnitIds: [...new Set(items.flatMap((item) => (item.assetUnitId ? [item.assetUnitId] : [])))],
      occurredAt: new Date().toISOString(),
    });
  }
}
