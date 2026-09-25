-- AlterTable
ALTER TABLE "finance_operations" ADD CONSTRAINT "finance_operations_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "finance_operations_tenantId_createdById_idx" ON "finance_operations"("tenantId", "createdById");
