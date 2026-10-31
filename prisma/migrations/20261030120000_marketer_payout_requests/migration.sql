-- AlterTable
ALTER TABLE "marketers" ADD COLUMN IF NOT EXISTS "bankName" TEXT;
ALTER TABLE "marketers" ADD COLUMN IF NOT EXISTS "bankBik" TEXT;
ALTER TABLE "marketers" ADD COLUMN IF NOT EXISTS "bankAccount" TEXT;
ALTER TABLE "marketers" ADD COLUMN IF NOT EXISTS "bankRecipient" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "marketer_payout_requests" (
    "id" TEXT NOT NULL,
    "marketerId" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'AWAITING_SIGNATURE',
    "bankName" TEXT NOT NULL,
    "bankBik" TEXT NOT NULL,
    "bankAccount" TEXT NOT NULL,
    "bankRecipient" TEXT NOT NULL,
    "signedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "rejectReason" TEXT,
    "dueBusinessDays" INTEGER NOT NULL DEFAULT 7,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketer_payout_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "marketer_payout_documents" (
    "id" TEXT NOT NULL,
    "payoutId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "signerEmail" TEXT,
    "codeSentAt" TIMESTAMP(3),
    "signedAt" TIMESTAMP(3),
    "signIp" TEXT,
    "signUserAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketer_payout_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "marketer_payout_requests_marketerId_status_createdAt_idx" ON "marketer_payout_requests"("marketerId", "status", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "marketer_payout_requests_status_createdAt_idx" ON "marketer_payout_requests"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "marketer_payout_documents_payoutId_key" ON "marketer_payout_documents"("payoutId");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "marketer_payout_requests" ADD CONSTRAINT "marketer_payout_requests_marketerId_fkey" FOREIGN KEY ("marketerId") REFERENCES "marketers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "marketer_payout_documents" ADD CONSTRAINT "marketer_payout_documents_payoutId_fkey" FOREIGN KEY ("payoutId") REFERENCES "marketer_payout_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
