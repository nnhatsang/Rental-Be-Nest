import { Injectable, Logger } from '@nestjs/common';
import { AuthAuditEvent, Prisma } from '@generated/prisma/client';
import { PrismaService } from '@modules/database/prisma.service';

export interface AuthAuditInput {
  event: AuthAuditEvent;
  userId?: string | null;
  sessionId?: string | null;
  actorSessionId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  deviceId?: string | null;
  reason?: string | null;
  metadata?: Prisma.InputJsonValue;
}

@Injectable()
export class AuthAuditService {
  private readonly logger = new Logger(AuthAuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(input: AuthAuditInput): Promise<void> {
    try {
      await this.prisma.authAuditLog.create({
        data: {
          event: input.event,
          userId: input.userId ?? null,
          sessionId: input.sessionId ?? null,
          actorSessionId: input.actorSessionId ?? null,
          ipAddress: input.ipAddress ?? null,
          userAgent: input.userAgent ?? null,
          deviceId: input.deviceId ?? null,
          reason: input.reason ?? null,
          metadata: input.metadata,
        },
      });
    } catch (error) {
      this.logger.error(`Failed to persist auth audit event ${input.event}`, error instanceof Error ? error.stack : undefined);
    }
  }
}
