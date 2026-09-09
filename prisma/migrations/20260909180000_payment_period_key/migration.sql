-- periodKey (YYYY-MM) for monthly payments + partial unique to prevent duplicates
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "periodKey" TEXT;

-- Предпочитаем месяц dueDate (биллинг), иначе createdAt.
-- Не трогаем уже cancelled и уже размеченные -dup-.
UPDATE "payments"
SET "periodKey" = to_char(COALESCE("dueDate", "createdAt") AT TIME ZONE 'Europe/Moscow', 'YYYY-MM')
WHERE "isMonthlyPayment" = true
  AND status <> 'cancelled'
  AND ("periodKey" IS NULL OR "periodKey" = '');

-- Один платёж на (tenant, client, group, periodKey):
-- оставляем paid (или самый ранний), лишние pending/overdue — cancel + снять periodKey,
-- лишние paid — уникализируем periodKey суффиксом.
WITH ranked AS (
  SELECT
    id,
    status,
    "periodKey",
    ROW_NUMBER() OVER (
      PARTITION BY "tenantId", "clientId", "groupId", "periodKey"
      ORDER BY
        CASE
          WHEN status = 'paid' THEN 0
          WHEN status IN ('pending', 'overdue') THEN 1
          ELSE 2
        END,
        "createdAt" ASC,
        id ASC
    ) AS rn
  FROM "payments"
  WHERE "isMonthlyPayment" = true
    AND "periodKey" IS NOT NULL
    AND "groupId" IS NOT NULL
    AND "periodKey" NOT LIKE '%-dup-%'
),
to_cancel AS (
  SELECT id FROM ranked
  WHERE rn > 1 AND status IN ('pending', 'overdue')
),
to_rename AS (
  SELECT id FROM ranked
  WHERE rn > 1 AND status NOT IN ('pending', 'overdue')
),
cancelled AS (
  UPDATE "payments" p
  SET
    status = 'cancelled',
    "paidAt" = NULL,
    "periodKey" = NULL
  FROM to_cancel t
  WHERE p.id = t.id
  RETURNING p.id, p."clientId", p."tenantId"
),
-- Вернуть списание с баланса по membership_charge этих счетов
restored AS (
  UPDATE "clients" c
  SET balance = c.balance + fo.amount
  FROM "finance_operations" fo
  INNER JOIN cancelled ca ON ca.id = fo."paymentId"
  WHERE fo."typeCode" = 'membership_charge'
    AND fo.direction = 'expense'
    AND fo."clientId" = c.id
  RETURNING fo.id AS fo_id
),
deleted_charges AS (
  DELETE FROM "finance_operations" fo
  USING cancelled ca
  WHERE fo."paymentId" = ca.id
    AND fo."typeCode" = 'membership_charge'
  RETURNING fo.id
),
renamed AS (
  UPDATE "payments" p
  SET "periodKey" = p."periodKey" || '-dup-' || p.id
  FROM to_rename t
  WHERE p.id = t.id
    AND p."periodKey" IS NOT NULL
    AND p."periodKey" NOT LIKE '%-dup-%'
  RETURNING p.id
)
SELECT
  (SELECT COUNT(*) FROM cancelled) AS cancelled_count,
  (SELECT COUNT(*) FROM restored) AS restored_count,
  (SELECT COUNT(*) FROM renamed) AS renamed_count;

CREATE UNIQUE INDEX IF NOT EXISTS "payments_monthly_period_unique"
ON "payments" ("tenantId", "clientId", "groupId", "periodKey")
WHERE "isMonthlyPayment" = true
  AND "periodKey" IS NOT NULL
  AND "groupId" IS NOT NULL;
