-- AlterTable (IF NOT EXISTS for idempotency in case a previous run failed partially)
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "password" TEXT,
ADD COLUMN IF NOT EXISTS "isAccountApproved" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "accountApprovedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "accountApprovedBy" TEXT,
ADD COLUMN IF NOT EXISTS "lastLogin" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "clientCanViewAllTrainers" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "clientCanViewAllBranches" BOOLEAN NOT NULL DEFAULT false;

