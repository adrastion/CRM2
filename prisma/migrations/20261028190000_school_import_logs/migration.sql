-- CreateTable
CREATE TABLE "school_import_logs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "superAdminId" TEXT,
    "success" BOOLEAN NOT NULL,
    "summary" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "school_import_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "school_import_logs_tenantId_createdAt_idx" ON "school_import_logs"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "school_import_logs_superAdminId_createdAt_idx" ON "school_import_logs"("superAdminId", "createdAt");

-- AddForeignKey
ALTER TABLE "school_import_logs" ADD CONSTRAINT "school_import_logs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "school_import_logs" ADD CONSTRAINT "school_import_logs_superAdminId_fkey" FOREIGN KEY ("superAdminId") REFERENCES "super_admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;
