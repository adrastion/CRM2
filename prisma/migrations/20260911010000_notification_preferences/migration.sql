-- Notification preferences (chat / changelog / schedule)
CREATE TABLE IF NOT EXISTS "notification_preferences" (
  "id" TEXT NOT NULL,
  "actorType" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "chatMessagesEnabled" BOOLEAN NOT NULL DEFAULT true,
  "changelogEnabled" BOOLEAN NOT NULL DEFAULT true,
  "pushMasterEnabled" BOOLEAN NOT NULL DEFAULT true,
  "scheduleMode" TEXT NOT NULL DEFAULT 'ALWAYS',
  "windowStartMinutes" INTEGER,
  "windowEndMinutes" INTEGER,
  "daysOfWeek" TEXT,
  "timezone" TEXT NOT NULL DEFAULT 'Europe/Moscow',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "notification_preferences_actorType_actorId_key"
  ON "notification_preferences"("actorType", "actorId");

CREATE INDEX IF NOT EXISTS "notification_preferences_actorType_actorId_idx"
  ON "notification_preferences"("actorType", "actorId");

-- Portal (client/parent) push subscriptions
CREATE TABLE IF NOT EXISTS "portal_push_subscriptions" (
  "id" TEXT NOT NULL,
  "clientId" TEXT,
  "parentId" TEXT,
  "endpoint" TEXT NOT NULL,
  "p256dh" TEXT NOT NULL,
  "auth" TEXT NOT NULL,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "portal_push_subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "portal_push_subscriptions_clientId_endpoint_key"
  ON "portal_push_subscriptions"("clientId", "endpoint");

CREATE UNIQUE INDEX IF NOT EXISTS "portal_push_subscriptions_parentId_endpoint_key"
  ON "portal_push_subscriptions"("parentId", "endpoint");

CREATE INDEX IF NOT EXISTS "portal_push_subscriptions_clientId_idx"
  ON "portal_push_subscriptions"("clientId");

CREATE INDEX IF NOT EXISTS "portal_push_subscriptions_parentId_idx"
  ON "portal_push_subscriptions"("parentId");

-- Tester push subscriptions
CREATE TABLE IF NOT EXISTS "tester_push_subscriptions" (
  "id" TEXT NOT NULL,
  "testerId" TEXT NOT NULL,
  "endpoint" TEXT NOT NULL,
  "p256dh" TEXT NOT NULL,
  "auth" TEXT NOT NULL,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tester_push_subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "tester_push_subscriptions_testerId_endpoint_key"
  ON "tester_push_subscriptions"("testerId", "endpoint");

DO $$ BEGIN
  ALTER TABLE "tester_push_subscriptions"
    ADD CONSTRAINT "tester_push_subscriptions_testerId_fkey"
    FOREIGN KEY ("testerId") REFERENCES "testers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
