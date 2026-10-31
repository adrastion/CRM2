-- AlterTable
ALTER TABLE "marketer_payout_requests" ADD COLUMN IF NOT EXISTS "dueAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "marketer_payout_requests_dueAt_idx" ON "marketer_payout_requests"("dueAt");

-- CreateTable
CREATE TABLE IF NOT EXISTS "marketer_npd_receipts" (
    "id" TEXT NOT NULL,
    "payoutId" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "originalName" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketer_npd_receipts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "marketer_npd_receipts_payoutId_key" ON "marketer_npd_receipts"("payoutId");

DO $$ BEGIN
  ALTER TABLE "marketer_npd_receipts" ADD CONSTRAINT "marketer_npd_receipts_payoutId_fkey"
    FOREIGN KEY ("payoutId") REFERENCES "marketer_payout_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Best-effort backfill dueAt for signed payouts (approx: signedAt + 7 calendar weekdays via SQL is hard;
-- set dueAt = signedAt + 9 calendar days as proxy for ~7 business days; app will recompute for new signs)
UPDATE "marketer_payout_requests"
SET "dueAt" = "signedAt" + INTERVAL '9 days'
WHERE "signedAt" IS NOT NULL AND "dueAt" IS NULL;
