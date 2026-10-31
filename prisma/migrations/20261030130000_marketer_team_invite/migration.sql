-- AlterTable Marketer: invite graph
ALTER TABLE "marketers" ADD COLUMN IF NOT EXISTS "invitedById" TEXT;
ALTER TABLE "marketers" ADD COLUMN IF NOT EXISTS "inviteToken" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "marketers_inviteToken_key" ON "marketers"("inviteToken");
CREATE INDEX IF NOT EXISTS "marketers_invitedById_idx" ON "marketers"("invitedById");

DO $$ BEGIN
  ALTER TABLE "marketers" ADD CONSTRAINT "marketers_invitedById_fkey"
    FOREIGN KEY ("invitedById") REFERENCES "marketers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AlterTable ledger: commission type
ALTER TABLE "marketer_commission_ledger" ADD COLUMN IF NOT EXISTS "commissionType" TEXT NOT NULL DEFAULT 'PERSONAL';
CREATE INDEX IF NOT EXISTS "marketer_commission_ledger_marketerId_commissionType_idx"
  ON "marketer_commission_ledger"("marketerId", "commissionType");
