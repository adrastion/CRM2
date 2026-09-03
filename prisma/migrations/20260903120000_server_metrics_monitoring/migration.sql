-- AlterTable
ALTER TABLE "super_admin_settings" ADD COLUMN IF NOT EXISTS "alertsEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "super_admin_settings" ADD COLUMN IF NOT EXISTS "alertCpuPercent" DOUBLE PRECISION NOT NULL DEFAULT 90;
ALTER TABLE "super_admin_settings" ADD COLUMN IF NOT EXISTS "alertMemoryPercent" DOUBLE PRECISION NOT NULL DEFAULT 90;
ALTER TABLE "super_admin_settings" ADD COLUMN IF NOT EXISTS "alertDiskPercent" DOUBLE PRECISION NOT NULL DEFAULT 90;
ALTER TABLE "super_admin_settings" ADD COLUMN IF NOT EXISTS "alertLoadPerCore" DOUBLE PRECISION NOT NULL DEFAULT 1;
ALTER TABLE "super_admin_settings" ADD COLUMN IF NOT EXISTS "alertCooldownMinutes" INTEGER NOT NULL DEFAULT 15;
ALTER TABLE "super_admin_settings" ADD COLUMN IF NOT EXISTS "lastAlertAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE IF NOT EXISTS "server_metric_samples" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cpuPercent" DOUBLE PRECISION NOT NULL,
    "memoryPercent" DOUBLE PRECISION NOT NULL,
    "memoryUsedMb" DOUBLE PRECISION NOT NULL,
    "memoryTotalMb" DOUBLE PRECISION NOT NULL,
    "load1" DOUBLE PRECISION NOT NULL,
    "load5" DOUBLE PRECISION NOT NULL,
    "load15" DOUBLE PRECISION NOT NULL,
    "diskPercent" DOUBLE PRECISION NOT NULL,
    "diskUsedGb" DOUBLE PRECISION NOT NULL,
    "diskTotalGb" DOUBLE PRECISION NOT NULL,
    "cpuCores" INTEGER NOT NULL,

    CONSTRAINT "server_metric_samples_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "server_metric_samples_timestamp_idx" ON "server_metric_samples"("timestamp");

-- CreateTable
CREATE TABLE IF NOT EXISTS "super_admin_push_subscriptions" (
    "id" TEXT NOT NULL,
    "superAdminId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "super_admin_push_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "super_admin_push_subscriptions_superAdminId_endpoint_key" ON "super_admin_push_subscriptions"("superAdminId", "endpoint");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "super_admin_push_subscriptions" ADD CONSTRAINT "super_admin_push_subscriptions_superAdminId_fkey" FOREIGN KEY ("superAdminId") REFERENCES "super_admins"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
