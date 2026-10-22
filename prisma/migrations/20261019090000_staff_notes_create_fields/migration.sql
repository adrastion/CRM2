ALTER TABLE "staff_notes" ADD COLUMN IF NOT EXISTS "categoryKey" TEXT NOT NULL DEFAULT 'general';
ALTER TABLE "staff_notes" ADD COLUMN IF NOT EXISTS "reminderKey" TEXT NOT NULL DEFAULT 'none';
ALTER TABLE "staff_notes" ADD COLUMN IF NOT EXISTS "relatedLink" TEXT;

CREATE INDEX IF NOT EXISTS "staff_notes_tenantId_categoryKey_idx" ON "staff_notes"("tenantId", "categoryKey");
