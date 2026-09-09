-- periodKey (YYYY-MM) for monthly payments + partial unique to prevent duplicates
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "periodKey" TEXT;

UPDATE "payments"
SET "periodKey" = to_char("createdAt" AT TIME ZONE 'Europe/Moscow', 'YYYY-MM')
WHERE "isMonthlyPayment" = true AND ("periodKey" IS NULL OR "periodKey" = '');

-- Drop duplicate monthly invoices for same client/group/period (keep earliest)
DELETE FROM "payments" p
USING "payments" d
WHERE p."isMonthlyPayment" = true
  AND d."isMonthlyPayment" = true
  AND p."tenantId" = d."tenantId"
  AND p."clientId" = d."clientId"
  AND p."groupId" IS NOT DISTINCT FROM d."groupId"
  AND p."periodKey" = d."periodKey"
  AND p."periodKey" IS NOT NULL
  AND p."createdAt" > d."createdAt";

CREATE UNIQUE INDEX IF NOT EXISTS "payments_monthly_period_unique"
ON "payments" ("tenantId", "clientId", "groupId", "periodKey")
WHERE "isMonthlyPayment" = true
  AND "periodKey" IS NOT NULL
  AND "groupId" IS NOT NULL;
