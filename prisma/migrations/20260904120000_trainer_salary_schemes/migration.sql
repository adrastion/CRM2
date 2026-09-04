-- AlterTable: tenant_settings
ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "salaryPayoutDay" INTEGER NOT NULL DEFAULT 25;

-- AlterTable: trainers
ALTER TABLE "trainers" ADD COLUMN IF NOT EXISTS "salaryScheme" TEXT NOT NULL DEFAULT 'per_training_person';
ALTER TABLE "trainers" ADD COLUMN IF NOT EXISTS "salaryRate" DECIMAL(65,30);

-- Backfill salaryScheme / salaryRate from legacy fields
UPDATE "trainers"
SET
  "salaryScheme" = CASE
    WHEN "salaryType" = 'percentage' THEN 'percent_month'
    WHEN "salaryType" = 'per_student' THEN 'per_training_person'
    WHEN "salaryType" = 'per_training' THEN 'per_training_person'
    WHEN "salaryType" = 'fixed' THEN 'fixed_monthly'
    WHEN "salaryType" = 'individual' THEN 'percent_month'
    ELSE 'per_training_person'
  END,
  "salaryRate" = COALESCE("salaryAmount", "salaryPercentage", 0)
WHERE "salaryRate" IS NULL;

-- CreateTable: trainer_salary_ledgers
CREATE TABLE IF NOT EXISTS "trainer_salary_ledgers" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "trainerId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "personName" TEXT,
    "title" TEXT NOT NULL,
    "comment" TEXT NOT NULL DEFAULT '',
    "clientId" TEXT,
    "trainingId" TEXT,
    "groupId" TEXT,
    "paymentId" TEXT,
    "attendanceId" TEXT,
    "periodKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trainer_salary_ledgers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "trainer_salary_ledgers_trainerId_attendanceId_key"
  ON "trainer_salary_ledgers"("trainerId", "attendanceId");

CREATE UNIQUE INDEX IF NOT EXISTS "trainer_salary_ledgers_trainerId_paymentId_kind_key"
  ON "trainer_salary_ledgers"("trainerId", "paymentId", "kind");

CREATE UNIQUE INDEX IF NOT EXISTS "trainer_salary_ledgers_trainerId_kind_periodKey_key"
  ON "trainer_salary_ledgers"("trainerId", "kind", "periodKey");

CREATE INDEX IF NOT EXISTS "trainer_salary_ledgers_tenantId_trainerId_occurredAt_idx"
  ON "trainer_salary_ledgers"("tenantId", "trainerId", "occurredAt");

CREATE INDEX IF NOT EXISTS "trainer_salary_ledgers_tenantId_occurredAt_idx"
  ON "trainer_salary_ledgers"("tenantId", "occurredAt");

ALTER TABLE "trainer_salary_ledgers"
  DROP CONSTRAINT IF EXISTS "trainer_salary_ledgers_trainerId_fkey";
ALTER TABLE "trainer_salary_ledgers"
  ADD CONSTRAINT "trainer_salary_ledgers_trainerId_fkey"
  FOREIGN KEY ("trainerId") REFERENCES "trainers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "trainer_salary_ledgers"
  DROP CONSTRAINT IF EXISTS "trainer_salary_ledgers_tenantId_fkey";
ALTER TABLE "trainer_salary_ledgers"
  ADD CONSTRAINT "trainer_salary_ledgers_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
