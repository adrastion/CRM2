-- AlterTable
ALTER TABLE "groups" ADD COLUMN IF NOT EXISTS "isMonthlyPayment" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "groups" ADD COLUMN IF NOT EXISTS "monthlyPaymentAmount" DECIMAL(10,2);
ALTER TABLE "groups" ADD COLUMN IF NOT EXISTS "paymentDueDay" INTEGER;
ALTER TABLE "groups" ADD COLUMN IF NOT EXISTS "trainerSalaryType" TEXT;
ALTER TABLE "groups" ADD COLUMN IF NOT EXISTS "trainerMonthlyPercentage" DECIMAL(5,2);
ALTER TABLE "groups" ADD COLUMN IF NOT EXISTS "trainerPerVisitPercentage" DECIMAL(5,2);
ALTER TABLE "groups" ADD COLUMN IF NOT EXISTS "trainerPerVisitAmount" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "groupId" TEXT;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "isMonthlyPayment" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "originalAmount" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "trainings" ADD COLUMN IF NOT EXISTS "price" DECIMAL(10,2);
ALTER TABLE "trainings" ADD COLUMN IF NOT EXISTS "trainerEarningType" TEXT;
ALTER TABLE "trainings" ADD COLUMN IF NOT EXISTS "trainerEarningValue" DECIMAL(10,2);

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

