-- Корректировки начисления (isAccrualAdjustment / status=adjustment) не должны
-- занимать слот unique (tenant, client, group, periodKey) ежемесячного счёта.
DROP INDEX IF EXISTS "payments_monthly_period_unique";

CREATE UNIQUE INDEX IF NOT EXISTS "payments_monthly_period_unique"
ON "payments" ("tenantId", "clientId", "groupId", "periodKey")
WHERE "isMonthlyPayment" = true
  AND "periodKey" IS NOT NULL
  AND "groupId" IS NOT NULL
  AND "isAccrualAdjustment" = false
  AND "status" NOT IN ('cancelled', 'adjustment');
