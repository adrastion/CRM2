-- AlterTable
ALTER TABLE "trainer_notification_settings" ADD COLUMN IF NOT EXISTS "timezone" TEXT DEFAULT 'UTC';

