-- FCM tokens for CRM2 mobile app
CREATE TABLE IF NOT EXISTS "mobile_device_tokens" (
    "id" TEXT NOT NULL,
    "actorType" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "platform" TEXT,
    "accountType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mobile_device_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "mobile_device_tokens_token_key" ON "mobile_device_tokens"("token");
CREATE INDEX IF NOT EXISTS "mobile_device_tokens_actorType_actorId_idx" ON "mobile_device_tokens"("actorType", "actorId");
