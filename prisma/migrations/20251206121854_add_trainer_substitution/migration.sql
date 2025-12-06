-- AlterTable
ALTER TABLE "trainings" ADD COLUMN IF NOT EXISTS "substituteTrainerId" TEXT;
ALTER TABLE "trainings" ADD COLUMN IF NOT EXISTS "originalTrainerId" TEXT;

-- AddForeignKey
ALTER TABLE "trainings" ADD CONSTRAINT "trainings_substituteTrainerId_fkey" FOREIGN KEY ("substituteTrainerId") REFERENCES "trainers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
