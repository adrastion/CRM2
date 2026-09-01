-- Деплой обновления на production (состояние БД = backup.sql от сервера).
--
-- На сервере применены миграции до add_standard_groups_relation включительно.
-- Этот файл идемпотентен: безопасно запускать повторно.
--
-- Применение: npx prisma migrate deploy
-- (или вручную: psql $DATABASE_URL -f prisma/migrations/20260902120000_deploy_production_update/migration.sql)

-- =============================================================================
-- 1. tenant_settings.membershipFeeResetDate
-- =============================================================================
ALTER TABLE "tenant_settings"
    ADD COLUMN IF NOT EXISTS "membershipFeeResetDate" TEXT;

-- =============================================================================
-- 2. Каталог тарифов подписок + снимки в платежах
-- =============================================================================
CREATE TABLE IF NOT EXISTS "subscription_plans" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DECIMAL(65,30),
    "maxTrainers" INTEGER,
    "maxClients" INTEGER,
    "maxGroups" INTEGER,
    "maxBranches" INTEGER,
    "maxTrainings" INTEGER,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "supportLevel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "subscription_plans_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "subscription_plans_code_key" ON "subscription_plans"("code");
CREATE INDEX IF NOT EXISTS "subscription_plans_isActive_isPublic_idx"
    ON "subscription_plans"("isActive", "isPublic");

INSERT INTO "subscription_plans"
    ("id", "code", "name", "description", "price",
     "maxTrainers", "maxClients", "maxGroups", "maxBranches", "maxTrainings",
     "isPublic", "isActive", "sortOrder", "supportLevel", "updatedAt")
VALUES
    ('plan_seed_free',         'FREE',         'Бесплатный',        'Для начинающих школ и тестирования системы', 0,
        1,    30,   3,  1,  10,   true, true, 0, 'Email (48 часов)',            CURRENT_TIMESTAMP),
    ('plan_seed_starter',      'STARTER',      'Стартовый',         'Для небольших школ, 1-2 филиала',            990,
        3,    90,   9,  2,  NULL, true, true, 1, 'Email (24 часа)',             CURRENT_TIMESTAMP),
    ('plan_seed_business',     'BUSINESS',     'Бизнес',            'Для средних школ, сеть филиалов',            2490,
        10,   600,  30, 5,  NULL, true, true, 2, 'Email + Telegram (12 часов)', CURRENT_TIMESTAMP),
    ('plan_seed_professional', 'PROFESSIONAL', 'Профессиональный',  'Для крупных школ и сетей',                   4990,
        25,   1500, 50, 10, NULL, true, true, 3, 'Приоритетная поддержка',      CURRENT_TIMESTAMP),
    ('plan_seed_enterprise',   'ENTERPRISE',   'Корпоративный',     'Индивидуальные условия для сетей',           NULL,
        NULL, NULL, NULL, NULL, NULL, true, true, 4, 'Персональный менеджер',   CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "isGranted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "grantedAt" TIMESTAMP(3);
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "grantedBy" TEXT;

ALTER TABLE "subscription_payments" ADD COLUMN IF NOT EXISTS "planCode" TEXT;
ALTER TABLE "subscription_payments" ADD COLUMN IF NOT EXISTS "listPrice" DECIMAL(65,30);
ALTER TABLE "subscription_payments" ADD COLUMN IF NOT EXISTS "discountAmount" DECIMAL(65,30);

UPDATE "subscription_payments" sp
SET "planCode" = s."planType"
FROM "subscriptions" s
WHERE sp."subscriptionId" = s."id" AND sp."planCode" IS NULL;

UPDATE "subscription_payments" sp
SET "discountAmount" = COALESCE(pcu."discountAmount", 0)
FROM "promo_code_usages" pcu
WHERE pcu."subscriptionPaymentId" = sp."id" AND sp."discountAmount" IS NULL;

UPDATE "subscription_payments"
SET "discountAmount" = 0
WHERE "discountAmount" IS NULL;

UPDATE "subscription_payments"
SET "listPrice" = "amount" + COALESCE("discountAmount", 0)
WHERE "listPrice" IS NULL;

CREATE TABLE IF NOT EXISTS "subscription_grant_logs" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "superAdminId" TEXT,
    "action" TEXT NOT NULL,
    "planCode" TEXT NOT NULL,
    "oldPlanCode" TEXT,
    "oldEndDate" TIMESTAMP(3),
    "newEndDate" TIMESTAMP(3),
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "subscription_grant_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "subscription_grant_logs_tenantId_createdAt_idx"
    ON "subscription_grant_logs"("tenantId", "createdAt");

DO $$ BEGIN
  ALTER TABLE "subscription_grant_logs"
    ADD CONSTRAINT "subscription_grant_logs_subscriptionId_fkey"
    FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "subscription_grant_logs"
    ADD CONSTRAINT "subscription_grant_logs_superAdminId_fkey"
    FOREIGN KEY ("superAdminId") REFERENCES "super_admins"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "super_admin_settings" ADD COLUMN IF NOT EXISTS "errorLogPath" TEXT;

-- =============================================================================
-- 3. transactions, admin_audit_logs, competitions
-- =============================================================================
CREATE TABLE IF NOT EXISTS "transactions" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "description" TEXT,
    "clientId" TEXT,
    "trainerId" TEXT,
    "trainingId" TEXT,
    "attendanceId" TEXT,
    "paymentId" TEXT,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "transactions_tenantId_type_idx" ON "transactions"("tenantId", "type");
CREATE INDEX IF NOT EXISTS "transactions_tenantId_createdAt_idx" ON "transactions"("tenantId", "createdAt");
CREATE INDEX IF NOT EXISTS "transactions_tenantId_clientId_idx" ON "transactions"("tenantId", "clientId");
CREATE INDEX IF NOT EXISTS "transactions_tenantId_trainerId_idx" ON "transactions"("tenantId", "trainerId");

DO $$ BEGIN
  ALTER TABLE "transactions" ADD CONSTRAINT "transactions_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "transactions" ADD CONSTRAINT "transactions_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "transactions" ADD CONSTRAINT "transactions_trainerId_fkey"
    FOREIGN KEY ("trainerId") REFERENCES "trainers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "transactions" ADD CONSTRAINT "transactions_trainingId_fkey"
    FOREIGN KEY ("trainingId") REFERENCES "trainings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "transactions" ADD CONSTRAINT "transactions_attendanceId_fkey"
    FOREIGN KEY ("attendanceId") REFERENCES "attendances"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "transactions" ADD CONSTRAINT "transactions_paymentId_fkey"
    FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "admin_audit_logs" (
    "id" TEXT NOT NULL,
    "superAdminId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "description" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "admin_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "admin_audit_logs_createdAt_idx" ON "admin_audit_logs"("createdAt");
CREATE INDEX IF NOT EXISTS "admin_audit_logs_action_idx" ON "admin_audit_logs"("action");

DO $$ BEGIN
  ALTER TABLE "admin_audit_logs" ADD CONSTRAINT "admin_audit_logs_superAdminId_fkey"
    FOREIGN KEY ("superAdminId") REFERENCES "super_admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "competitions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "registrationDate" TIMESTAMP(3) NOT NULL,
    "registrationTime" TIMESTAMP(3),
    "isElectronicRegistration" BOOLEAN NOT NULL DEFAULT false,
    "positionDocument" TEXT,
    "regulationsDocument" TEXT,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "competitions_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "competitions" ADD CONSTRAINT "competitions_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "competition_participants" (
    "id" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "competition_participants_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "competition_participants_competitionId_clientId_key"
    ON "competition_participants"("competitionId", "clientId");

DO $$ BEGIN
  ALTER TABLE "competition_participants" ADD CONSTRAINT "competition_participants_competitionId_fkey"
    FOREIGN KEY ("competitionId") REFERENCES "competitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "competition_participants" ADD CONSTRAINT "competition_participants_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "competition_participants" ADD CONSTRAINT "competition_participants_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "competition_results" (
    "id" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "result" TEXT,
    "resultValue" DECIMAL(65,30),
    "category" TEXT,
    "performanceTime" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "competition_results_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "competition_results" ADD CONSTRAINT "competition_results_competitionId_fkey"
    FOREIGN KEY ("competitionId") REFERENCES "competitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "competition_results" ADD CONSTRAINT "competition_results_participantId_fkey"
    FOREIGN KEY ("participantId") REFERENCES "competition_participants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "competition_trainers" (
    "id" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "trainerId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "competition_trainers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "competition_trainers_competitionId_trainerId_key"
    ON "competition_trainers"("competitionId", "trainerId");

DO $$ BEGIN
  ALTER TABLE "competition_trainers" ADD CONSTRAINT "competition_trainers_competitionId_fkey"
    FOREIGN KEY ("competitionId") REFERENCES "competitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "competition_trainers" ADD CONSTRAINT "competition_trainers_trainerId_fkey"
    FOREIGN KEY ("trainerId") REFERENCES "trainers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "competition_trainers" ADD CONSTRAINT "competition_trainers_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "competition_attendances" (
    "id" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "notes" TEXT,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "competition_attendances_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "competition_attendances_participantId_key"
    ON "competition_attendances"("participantId");

DO $$ BEGIN
  ALTER TABLE "competition_attendances" ADD CONSTRAINT "competition_attendances_competitionId_fkey"
    FOREIGN KEY ("competitionId") REFERENCES "competitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "competition_attendances" ADD CONSTRAINT "competition_attendances_participantId_fkey"
    FOREIGN KEY ("participantId") REFERENCES "competition_participants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "competition_attendances" ADD CONSTRAINT "competition_attendances_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =============================================================================
-- 4. Раздел «Финансы»: типы операций и ledger
-- =============================================================================
CREATE TABLE IF NOT EXISTS "finance_operation_types" (
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

CREATE UNIQUE INDEX IF NOT EXISTS "finance_operation_types_tenantId_code_key"
    ON "finance_operation_types"("tenantId", "code");
CREATE INDEX IF NOT EXISTS "finance_operation_types_tenantId_isActive_idx"
    ON "finance_operation_types"("tenantId", "isActive");
CREATE UNIQUE INDEX IF NOT EXISTS "finance_operation_types_system_code_key"
    ON "finance_operation_types"("code") WHERE "tenantId" IS NULL;

DO $$ BEGIN
  ALTER TABLE "finance_operation_types"
    ADD CONSTRAINT "finance_operation_types_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

INSERT INTO "finance_operation_types"
    ("id", "tenantId", "code", "name", "defaultDirection", "isSystem", "isActive", "updatedAt")
VALUES
    ('fin_type_salary',         NULL, 'salary',         'Зарплата',                   'expense', true, true, CURRENT_TIMESTAMP),
    ('fin_type_rent',           NULL, 'rent',           'Аренда',                     'expense', true, true, CURRENT_TIMESTAMP),
    ('fin_type_membership',     NULL, 'membership',     'Оплата абонемента',          'income',  true, true, CURRENT_TIMESTAMP),
    ('fin_type_client_payment', NULL, 'client_payment', 'Принятие оплаты от клиента', 'income',  true, true, CURRENT_TIMESTAMP),
    ('fin_type_bonus',          NULL, 'bonus',          'Премия',                     'expense', true, true, CURRENT_TIMESTAMP),
    ('fin_type_purchase',       NULL, 'purchase',       'Покупка',                    'expense', true, true, CURRENT_TIMESTAMP),
    ('fin_type_advertising',    NULL, 'advertising',    'Реклама',                    'expense', true, true, CURRENT_TIMESTAMP),
    ('fin_type_other',          NULL, 'other',          'Прочее',                     'expense', true, true, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

CREATE TABLE IF NOT EXISTS "finance_operations" (
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

CREATE UNIQUE INDEX IF NOT EXISTS "finance_operations_paymentId_key" ON "finance_operations"("paymentId");
CREATE INDEX IF NOT EXISTS "finance_operations_tenantId_occurredAt_idx" ON "finance_operations"("tenantId", "occurredAt");
CREATE INDEX IF NOT EXISTS "finance_operations_tenantId_typeCode_idx" ON "finance_operations"("tenantId", "typeCode");
CREATE INDEX IF NOT EXISTS "finance_operations_tenantId_direction_idx" ON "finance_operations"("tenantId", "direction");
CREATE INDEX IF NOT EXISTS "finance_operations_tenantId_clientId_idx" ON "finance_operations"("tenantId", "clientId");
CREATE INDEX IF NOT EXISTS "finance_operations_tenantId_trainerId_idx" ON "finance_operations"("tenantId", "trainerId");
CREATE INDEX IF NOT EXISTS "finance_operations_tenantId_groupId_idx" ON "finance_operations"("tenantId", "groupId");
CREATE INDEX IF NOT EXISTS "finance_operations_tenantId_branchId_idx" ON "finance_operations"("tenantId", "branchId");

DO $$ BEGIN
  ALTER TABLE "finance_operations" ADD CONSTRAINT "finance_operations_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "finance_operations" ADD CONSTRAINT "finance_operations_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "finance_operations" ADD CONSTRAINT "finance_operations_trainerId_fkey"
    FOREIGN KEY ("trainerId") REFERENCES "trainers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "finance_operations" ADD CONSTRAINT "finance_operations_groupId_fkey"
    FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "finance_operations" ADD CONSTRAINT "finance_operations_branchId_fkey"
    FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "finance_operations" ADD CONSTRAINT "finance_operations_paymentId_fkey"
    FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
