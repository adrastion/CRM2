-- AlterTable: Client.createdByUserId (PROMOTER ownership)
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "createdByUserId" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "clients_createdByUserId_idx" ON "clients"("createdByUserId");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'clients_createdByUserId_fkey'
  ) THEN
    ALTER TABLE "clients"
      ADD CONSTRAINT "clients_createdByUserId_fkey"
      FOREIGN KEY ("createdByUserId") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
