-- CreateTable
CREATE TABLE IF NOT EXISTS "budget_limits" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT,
    "categoryName" TEXT,
    "limitAmount" DECIMAL(65,30) NOT NULL,
    "period" TEXT NOT NULL,
    "currentSpent" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "settingsId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "budget_limits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "admin_audit_logs" (
    "id" TEXT NOT NULL,
    "superAdminId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "description" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_audit_logs_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "admin_transactions" ADD COLUMN IF NOT EXISTS "documentUrl" TEXT;
ALTER TABLE "admin_transactions" ADD COLUMN IF NOT EXISTS "isRecurring" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "admin_transactions" ADD COLUMN IF NOT EXISTS "recurringPeriod" TEXT;
ALTER TABLE "admin_transactions" ADD COLUMN IF NOT EXISTS "nextDueDate" TIMESTAMP(3);

-- AddForeignKey
ALTER TABLE "budget_limits" ADD CONSTRAINT "budget_limits_settingsId_fkey" FOREIGN KEY ("settingsId") REFERENCES "super_admin_settings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_audit_logs" ADD CONSTRAINT "admin_audit_logs_superAdminId_fkey" FOREIGN KEY ("superAdminId") REFERENCES "super_admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

