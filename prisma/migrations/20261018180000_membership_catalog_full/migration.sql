ALTER TABLE "memberships"
ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "memberships_tenantId_archivedAt_idx"
ON "memberships"("tenantId", "archivedAt");
