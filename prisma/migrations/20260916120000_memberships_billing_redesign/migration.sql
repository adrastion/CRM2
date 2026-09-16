-- AlterTable trainers
ALTER TABLE "trainers" ADD COLUMN IF NOT EXISTS "individualTrainingPrice" DECIMAL(65,30);

-- AlterTable group_memberships
ALTER TABLE "group_memberships" ADD COLUMN IF NOT EXISTS "billingEffectiveFrom" TIMESTAMP(3);

-- AlterTable memberships
ALTER TABLE "memberships" ADD COLUMN IF NOT EXISTS "category" TEXT NOT NULL DEFAULT 'CLIENT';
ALTER TABLE "memberships" ADD COLUMN IF NOT EXISTS "paymentWindowStartDay" INTEGER;
ALTER TABLE "memberships" ADD COLUMN IF NOT EXISTS "paymentWindowEndDay" INTEGER;
ALTER TABLE "memberships" ADD COLUMN IF NOT EXISTS "recalcMode" TEXT;
ALTER TABLE "memberships" ADD COLUMN IF NOT EXISTS "missThresholdPercent" DECIMAL(65,30);
ALTER TABLE "memberships" ADD COLUMN IF NOT EXISTS "midMonthHalfChargeEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "memberships" ADD COLUMN IF NOT EXISTS "validityDays" INTEGER;
ALTER TABLE "memberships" ADD COLUMN IF NOT EXISTS "periodType" TEXT;
ALTER TABLE "memberships" ADD COLUMN IF NOT EXISTS "periodMonths" INTEGER;

CREATE INDEX IF NOT EXISTS "memberships_tenantId_category_isActive_idx" ON "memberships"("tenantId", "category", "isActive");

-- AlterTable payments
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "recalcAppliedPercent" DECIMAL(65,30);
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "recalcReason" TEXT;

-- CreateTable membership_groups
CREATE TABLE IF NOT EXISTS "membership_groups" (
    "id" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "membership_groups_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "membership_groups_groupId_key" ON "membership_groups"("groupId");
CREATE INDEX IF NOT EXISTS "membership_groups_membershipId_idx" ON "membership_groups"("membershipId");

DO $$ BEGIN
  ALTER TABLE "membership_groups" ADD CONSTRAINT "membership_groups_membershipId_fkey"
    FOREIGN KEY ("membershipId") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "membership_groups" ADD CONSTRAINT "membership_groups_groupId_fkey"
    FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Backfill: existing CLIENT memberships get periodType from type
UPDATE "memberships"
SET "periodType" = CASE
  WHEN "type" = 'visits' THEN 'VISITS'
  WHEN "type" = 'monthly' THEN 'FIXED_DAYS'
  ELSE COALESCE("periodType", 'VISITS')
END,
"validityDays" = COALESCE("validityDays", "duration")
WHERE "category" = 'CLIENT';

-- Backfill GROUP memberships from legacy group monthly flags
INSERT INTO "memberships" (
  "id", "name", "description", "price", "duration", "type", "isActive", "tenantId",
  "createdAt", "updatedAt", "visits", "category",
  "paymentWindowStartDay", "paymentWindowEndDay", "recalcMode",
  "missThresholdPercent", "midMonthHalfChargeEnabled", "periodType"
)
SELECT
  'mig_grp_' || g."id",
  'Ежемесячная оплата: ' || g."name",
  'Автомиграция с группы',
  COALESCE(g."monthlyPaymentAmount", 0),
  NULL,
  'group_monthly',
  true,
  g."tenantId",
  NOW(),
  NOW(),
  NULL,
  'GROUP',
  1,
  COALESCE(g."paymentDueDay", 6),
  'MISS_THRESHOLD',
  50,
  true,
  NULL
FROM "groups" g
WHERE g."isMonthlyPayment" = true
  AND g."monthlyPaymentAmount" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "membership_groups" mg WHERE mg."groupId" = g."id"
  )
  AND NOT EXISTS (
    SELECT 1 FROM "memberships" m WHERE m."id" = 'mig_grp_' || g."id"
  );

INSERT INTO "membership_groups" ("id", "membershipId", "groupId", "effectiveFrom", "createdAt", "updatedAt")
SELECT
  'mig_mg_' || g."id",
  'mig_grp_' || g."id",
  g."id",
  COALESCE(g."createdAt", NOW()),
  NOW(),
  NOW()
FROM "groups" g
WHERE g."isMonthlyPayment" = true
  AND g."monthlyPaymentAmount" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "membership_groups" mg WHERE mg."groupId" = g."id"
  )
  AND EXISTS (
    SELECT 1 FROM "memberships" m WHERE m."id" = 'mig_grp_' || g."id"
  );
