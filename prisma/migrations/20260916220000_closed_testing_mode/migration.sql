-- AlterTable
ALTER TABLE "super_admin_settings" ADD COLUMN IF NOT EXISTS "closedTestingMode" BOOLEAN NOT NULL DEFAULT false;
