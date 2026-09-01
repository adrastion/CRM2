-- Раздел «Финансы»: типы операций и единый ledger школы

CREATE TABLE "finance_operation_types" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "defaultDirection" TEXT NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "finance_operation_types_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "finance_operation_types_tenantId_code_key"
    ON "finance_operation_types"("tenantId", "code");
CREATE INDEX "finance_operation_types_tenantId_isActive_idx"
    ON "finance_operation_types"("tenantId", "isActive");

ALTER TABLE "finance_operation_types"
    ADD CONSTRAINT "finance_operation_types_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- Системные типы (tenantId IS NULL). Уникальность для NULL в PG через частичный индекс.
CREATE UNIQUE INDEX "finance_operation_types_system_code_key"
    ON "finance_operation_types"("code") WHERE "tenantId" IS NULL;

INSERT INTO "finance_operation_types"
    ("id", "tenantId", "code", "name", "defaultDirection", "isSystem", "isActive", "updatedAt")
VALUES
    ('fin_type_salary',            NULL, 'salary',            'Зарплата',                    'expense', true, true, CURRENT_TIMESTAMP),
    ('fin_type_rent',              NULL, 'rent',              'Аренда',                      'expense', true, true, CURRENT_TIMESTAMP),
    ('fin_type_membership',        NULL, 'membership',        'Оплата абонемента',           'income',  true, true, CURRENT_TIMESTAMP),
    ('fin_type_client_payment',    NULL, 'client_payment',    'Принятие оплаты от клиента',  'income',  true, true, CURRENT_TIMESTAMP),
    ('fin_type_bonus',             NULL, 'bonus',             'Премия',                      'expense', true, true, CURRENT_TIMESTAMP),
    ('fin_type_purchase',          NULL, 'purchase',          'Покупка',                     'expense', true, true, CURRENT_TIMESTAMP),
    ('fin_type_advertising',       NULL, 'advertising',       'Реклама',                     'expense', true, true, CURRENT_TIMESTAMP),
    ('fin_type_other',             NULL, 'other',             'Прочее',                      'expense', true, true, CURRENT_TIMESTAMP);

CREATE TABLE "finance_operations" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "typeCode" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "clientId" TEXT,
    "trainerId" TEXT,
    "groupId" TEXT,
    "branchId" TEXT,
    "paymentId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "finance_operations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "finance_operations_paymentId_key" ON "finance_operations"("paymentId");
CREATE INDEX "finance_operations_tenantId_occurredAt_idx" ON "finance_operations"("tenantId", "occurredAt");
CREATE INDEX "finance_operations_tenantId_typeCode_idx" ON "finance_operations"("tenantId", "typeCode");
CREATE INDEX "finance_operations_tenantId_direction_idx" ON "finance_operations"("tenantId", "direction");
CREATE INDEX "finance_operations_tenantId_clientId_idx" ON "finance_operations"("tenantId", "clientId");
CREATE INDEX "finance_operations_tenantId_trainerId_idx" ON "finance_operations"("tenantId", "trainerId");
CREATE INDEX "finance_operations_tenantId_groupId_idx" ON "finance_operations"("tenantId", "groupId");
CREATE INDEX "finance_operations_tenantId_branchId_idx" ON "finance_operations"("tenantId", "branchId");

ALTER TABLE "finance_operations"
    ADD CONSTRAINT "finance_operations_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "finance_operations"
    ADD CONSTRAINT "finance_operations_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "finance_operations"
    ADD CONSTRAINT "finance_operations_trainerId_fkey"
    FOREIGN KEY ("trainerId") REFERENCES "trainers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "finance_operations"
    ADD CONSTRAINT "finance_operations_groupId_fkey"
    FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "finance_operations"
    ADD CONSTRAINT "finance_operations_branchId_fkey"
    FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "finance_operations"
    ADD CONSTRAINT "finance_operations_paymentId_fkey"
    FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
