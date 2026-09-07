-- New finance operation types + externalKey for idempotent event logging
ALTER TABLE "finance_operations" ADD COLUMN IF NOT EXISTS "externalKey" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "finance_operations_tenantId_externalKey_key"
  ON "finance_operations"("tenantId", "externalKey");

INSERT INTO "finance_operation_types"
    ("id", "tenantId", "code", "name", "defaultDirection", "isSystem", "isActive", "updatedAt")
SELECT v.id, NULL, v.code, v.name, v.dir, true, true, CURRENT_TIMESTAMP
FROM (VALUES
    ('fin_type_membership_issue',  'membership_issue',  'Выдача абонемента',            'expense'),
    ('fin_type_membership_charge', 'membership_charge', 'Начисление / счёт абонемента', 'expense'),
    ('fin_type_salary_accrual',    'salary_accrual',    'Начисление зарплаты тренеру',  'expense')
) AS v(id, code, name, dir)
WHERE NOT EXISTS (
  SELECT 1 FROM "finance_operation_types" t
  WHERE t."tenantId" IS NULL AND t."code" = v.code
);
