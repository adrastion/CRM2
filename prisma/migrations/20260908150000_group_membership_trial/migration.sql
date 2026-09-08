-- Пробные занятия: временное членство в группе
ALTER TABLE "group_memberships" ADD COLUMN IF NOT EXISTS "isTrial" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "group_memberships" ADD COLUMN IF NOT EXISTS "trialTrainingId" TEXT;

CREATE INDEX IF NOT EXISTS "group_memberships_isTrial_isActive_idx" ON "group_memberships"("isTrial", "isActive");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'group_memberships_trialTrainingId_fkey'
  ) THEN
    ALTER TABLE "group_memberships"
      ADD CONSTRAINT "group_memberships_trialTrainingId_fkey"
      FOREIGN KEY ("trialTrainingId") REFERENCES "trainings"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
