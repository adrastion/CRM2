-- AlterTable
ALTER TABLE "support_tickets" ADD COLUMN IF NOT EXISTS "marketerId" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "support_tickets_marketerId_status_idx" ON "support_tickets"("marketerId", "status");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "support_tickets"
    ADD CONSTRAINT "support_tickets_marketerId_fkey"
    FOREIGN KEY ("marketerId") REFERENCES "marketers"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
