-- AlterTable
ALTER TABLE "clients" ADD COLUMN "password" TEXT,
ADD COLUMN "isAccountApproved" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "accountApprovedAt" TIMESTAMP(3),
ADD COLUMN "accountApprovedBy" TEXT,
ADD COLUMN "lastLogin" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "tenant_settings" ADD COLUMN "clientCanViewAllTrainers" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "clientCanViewAllBranches" BOOLEAN NOT NULL DEFAULT false;

