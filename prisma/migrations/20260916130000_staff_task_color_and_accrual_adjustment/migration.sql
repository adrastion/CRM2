-- Цвет задач на календарном плане
ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "staffTaskColor" TEXT DEFAULT '#6A1B9A';

-- Корректировки начислений (append-only)
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "correctsPaymentId" TEXT;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "isAccrualAdjustment" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "adjustmentReason" TEXT;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "adjustedByUserId" TEXT;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "adjustedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "payments_correctsPaymentId_idx" ON "payments"("correctsPaymentId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'payments_correctsPaymentId_fkey'
  ) THEN
    ALTER TABLE "payments"
      ADD CONSTRAINT "payments_correctsPaymentId_fkey"
      FOREIGN KEY ("correctsPaymentId") REFERENCES "payments"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'payments_adjustedByUserId_fkey'
  ) THEN
    ALTER TABLE "payments"
      ADD CONSTRAINT "payments_adjustedByUserId_fkey"
      FOREIGN KEY ("adjustedByUserId") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

INSERT INTO "finance_operation_types"
    ("id", "tenantId", "code", "name", "defaultDirection", "isSystem", "isActive", "updatedAt")
SELECT v.id, NULL, v.code, v.name, v.dir, true, true, CURRENT_TIMESTAMP
FROM (VALUES
    ('fin_type_membership_charge_adj', 'membership_charge_adjustment', 'Корректировка начисления', 'expense')
) AS v(id, code, name, dir)
WHERE NOT EXISTS (
  SELECT 1 FROM "finance_operation_types" t
  WHERE t."tenantId" IS NULL AND t."code" = v.code
);
