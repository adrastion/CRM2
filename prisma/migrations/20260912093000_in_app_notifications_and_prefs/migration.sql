-- AlterTable notification_preferences
ALTER TABLE "notification_preferences" ADD COLUMN IF NOT EXISTS "athleteCreatedEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "notification_preferences" ADD COLUMN IF NOT EXISTS "financeEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "notification_preferences" ADD COLUMN IF NOT EXISTS "attendanceEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "notification_preferences" ADD COLUMN IF NOT EXISTS "offersEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "notification_preferences" ADD COLUMN IF NOT EXISTS "salaryEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "notification_preferences" ADD COLUMN IF NOT EXISTS "paymentsEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "notification_preferences" ADD COLUMN IF NOT EXISTS "trainingRemindersEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "notification_preferences" ADD COLUMN IF NOT EXISTS "scheduleChangesEnabled" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable in_app_notifications
CREATE TABLE IF NOT EXISTS "in_app_notifications" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "actorType" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "data" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "in_app_notifications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "in_app_notifications_actorType_actorId_readAt_idx" ON "in_app_notifications"("actorType", "actorId", "readAt");
CREATE INDEX IF NOT EXISTS "in_app_notifications_actorType_actorId_category_readAt_idx" ON "in_app_notifications"("actorType", "actorId", "category", "readAt");
CREATE INDEX IF NOT EXISTS "in_app_notifications_tenantId_category_idx" ON "in_app_notifications"("tenantId", "category");

-- CreateTable platform_school_offers
CREATE TABLE IF NOT EXISTS "platform_school_offers" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "url" TEXT,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "platform_school_offers_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "platform_school_offers_publishedAt_idx" ON "platform_school_offers"("publishedAt");
