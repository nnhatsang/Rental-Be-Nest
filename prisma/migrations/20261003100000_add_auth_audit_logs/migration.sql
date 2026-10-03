BEGIN;

CREATE TYPE "AuthAuditEvent" AS ENUM (
    'LOGIN_SUCCEEDED',
    'LOGOUT',
    'SESSION_REVOKED',
    'SESSIONS_REVOKED',
    'PASSWORD_CHANGED',
    'PASSWORD_RESET'
);

CREATE TABLE "AuthAuditLog" (
    "id" UUID NOT NULL,
    "userId" UUID,
    "sessionId" TEXT,
    "actorSessionId" TEXT,
    "event" "AuthAuditEvent" NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "deviceId" TEXT,
    "reason" TEXT,
    "metadata" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AuthAuditLog_userId_occurredAt_idx"
    ON "AuthAuditLog"("userId", "occurredAt");

CREATE INDEX "AuthAuditLog_sessionId_occurredAt_idx"
    ON "AuthAuditLog"("sessionId", "occurredAt");

CREATE INDEX "AuthAuditLog_event_occurredAt_idx"
    ON "AuthAuditLog"("event", "occurredAt");

ALTER TABLE "AuthAuditLog"
    ADD CONSTRAINT "AuthAuditLog_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

COMMIT;
