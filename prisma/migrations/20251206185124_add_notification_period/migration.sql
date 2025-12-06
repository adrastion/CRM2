-- AlterTable
ALTER TABLE "trainer_notification_settings" ADD COLUMN IF NOT EXISTS "notificationPeriod" TEXT DEFAULT 'tomorrow';
