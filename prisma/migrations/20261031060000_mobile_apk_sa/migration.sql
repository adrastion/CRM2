-- AlterTable
ALTER TABLE "super_admin_settings" ADD COLUMN "mobileApkPath" TEXT;
ALTER TABLE "super_admin_settings" ADD COLUMN "mobileApkOriginalName" TEXT;
ALTER TABLE "super_admin_settings" ADD COLUMN "mobileApkSize" INTEGER;
ALTER TABLE "super_admin_settings" ADD COLUMN "mobileApkLabel" TEXT;
ALTER TABLE "super_admin_settings" ADD COLUMN "mobileApkUploadedAt" TIMESTAMP(3);
