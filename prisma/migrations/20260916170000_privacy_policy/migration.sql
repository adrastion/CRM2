-- AlterTable
ALTER TABLE "super_admin_settings" ADD COLUMN IF NOT EXISTS "privacyPolicyText" TEXT;
ALTER TABLE "super_admin_settings" ADD COLUMN IF NOT EXISTS "privacyUpdatedAt" TIMESTAMP(3);
