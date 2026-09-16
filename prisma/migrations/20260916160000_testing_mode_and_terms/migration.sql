-- AlterTable
ALTER TABLE "super_admin_settings" ADD COLUMN IF NOT EXISTS "testingMode" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "super_admin_settings" ADD COLUMN IF NOT EXISTS "testingModeAllowlist" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "super_admin_settings" ADD COLUMN IF NOT EXISTS "termsOfServiceText" TEXT;
ALTER TABLE "super_admin_settings" ADD COLUMN IF NOT EXISTS "termsUpdatedAt" TIMESTAMP(3);
