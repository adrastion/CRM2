-- AlterTable
ALTER TABLE "super_admin_settings" ADD COLUMN IF NOT EXISTS "maintenanceMode" BOOLEAN NOT NULL DEFAULT false;
