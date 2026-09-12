-- AlterTable
ALTER TABLE "branches" ADD COLUMN IF NOT EXISTS "seniorTrainerId" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "branches_seniorTrainerId_idx" ON "branches"("seniorTrainerId");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'branches_seniorTrainerId_fkey'
  ) THEN
    ALTER TABLE "branches"
      ADD CONSTRAINT "branches_seniorTrainerId_fkey"
      FOREIGN KEY ("seniorTrainerId") REFERENCES "trainers"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
