-- AlterTable tenant_marketers
ALTER TABLE "tenant_marketers" ADD COLUMN IF NOT EXISTS "firstPaidAt" TIMESTAMP(3);
ALTER TABLE "tenant_marketers" ADD COLUMN IF NOT EXISTS "commissionRightActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "tenant_marketers" ADD COLUMN IF NOT EXISTS "commissionRightLostAt" TIMESTAMP(3);
ALTER TABLE "tenant_marketers" ADD COLUMN IF NOT EXISTS "commissionRightLostReason" TEXT;

CREATE INDEX IF NOT EXISTS "tenant_marketers_marketerId_firstPaidAt_idx"
  ON "tenant_marketers"("marketerId", "firstPaidAt");

-- CreateTable periods
CREATE TABLE IF NOT EXISTS "marketer_activity_periods" (
    "id" TEXT NOT NULL,
    "marketerId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "targetCount" INTEGER NOT NULL DEFAULT 3,
    "qualifiedCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketer_activity_periods_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "marketer_activity_qualifications" (
    "id" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "paymentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "marketer_activity_qualifications_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "marketer_activity_exclusions" (
    "id" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "lostAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "marketer_activity_exclusions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "marketer_activity_periods_marketerId_startsAt_key"
  ON "marketer_activity_periods"("marketerId", "startsAt");
CREATE INDEX IF NOT EXISTS "marketer_activity_periods_marketerId_status_endsAt_idx"
  ON "marketer_activity_periods"("marketerId", "status", "endsAt");

CREATE UNIQUE INDEX IF NOT EXISTS "marketer_activity_qualifications_periodId_tenantId_key"
  ON "marketer_activity_qualifications"("periodId", "tenantId");
CREATE INDEX IF NOT EXISTS "marketer_activity_qualifications_tenantId_idx"
  ON "marketer_activity_qualifications"("tenantId");

CREATE UNIQUE INDEX IF NOT EXISTS "marketer_activity_exclusions_periodId_tenantId_key"
  ON "marketer_activity_exclusions"("periodId", "tenantId");
CREATE INDEX IF NOT EXISTS "marketer_activity_exclusions_tenantId_idx"
  ON "marketer_activity_exclusions"("tenantId");

DO $$ BEGIN
  ALTER TABLE "marketer_activity_periods" ADD CONSTRAINT "marketer_activity_periods_marketerId_fkey"
    FOREIGN KEY ("marketerId") REFERENCES "marketers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "marketer_activity_qualifications" ADD CONSTRAINT "marketer_activity_qualifications_periodId_fkey"
    FOREIGN KEY ("periodId") REFERENCES "marketer_activity_periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "marketer_activity_exclusions" ADD CONSTRAINT "marketer_activity_exclusions_periodId_fkey"
    FOREIGN KEY ("periodId") REFERENCES "marketer_activity_periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Best-effort backfill firstPaidAt from earliest succeeded paid subscription payment after link
UPDATE "tenant_marketers" tm
SET "firstPaidAt" = sub.first_paid
FROM (
  SELECT tm2.id AS link_id, MIN(sp."paidAt") AS first_paid
  FROM "tenant_marketers" tm2
  INNER JOIN "subscriptions" s ON s."tenantId" = tm2."tenantId"
  INNER JOIN "subscription_payments" sp ON sp."subscriptionId" = s.id
  WHERE sp.status = 'succeeded'
    AND sp.amount > 0
    AND sp."paidAt" IS NOT NULL
    AND sp."paidAt" >= tm2."createdAt"
  GROUP BY tm2.id
) sub
WHERE tm.id = sub.link_id
  AND tm."firstPaidAt" IS NULL;
