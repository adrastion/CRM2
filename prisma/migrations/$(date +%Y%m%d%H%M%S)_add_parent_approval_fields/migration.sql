-- AlterTable
ALTER TABLE "parents" ADD COLUMN IF NOT EXISTS "approvalToken" TEXT,
ADD COLUMN IF NOT EXISTS "isApproved" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "approvalTokenExpiresAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "parents_approvalToken_key" ON "parents"("approvalToken");
