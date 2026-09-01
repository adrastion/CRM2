-- Каталог тарифов в базе данных + история выдачи + снимки цен в платежах.
--
-- До этой миграции тарифы были захардкожены в src/services/subscriptionService.ts
-- (PLAN_PRICES / PLAN_LIMITS) и правились мутацией константы в памяти, что терялось
-- при перезапуске и задним числом переписывало историю выручки.

-- 1. Каталог тарифов ---------------------------------------------------------
CREATE TABLE "subscription_plans" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    -- NULL = «Цена договорная»
    "price" DECIMAL(65,30),
    -- NULL в лимитах = «Безлимит»
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

CREATE UNIQUE INDEX "subscription_plans_code_key" ON "subscription_plans"("code");
CREATE INDEX "subscription_plans_isActive_isPublic_idx" ON "subscription_plans"("isActive", "isPublic");

-- Перенос действующих тарифов из кода. Значения соответствуют прежним
-- PLAN_PRICES/PLAN_LIMITS, чтобы поведение не изменилось после миграции.
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
    -- price = NULL → «Цена договорная»
    ('plan_seed_enterprise',   'ENTERPRISE',   'Корпоративный',     'Индивидуальные условия для сетей',           NULL,
        NULL, NULL, NULL, NULL, NULL, true, true, 4, 'Персональный менеджер',   CURRENT_TIMESTAMP);

-- 2. Признак выданного вручную тарифа ----------------------------------------
ALTER TABLE "subscriptions" ADD COLUMN "isGranted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "subscriptions" ADD COLUMN "grantedAt" TIMESTAMP(3);
ALTER TABLE "subscriptions" ADD COLUMN "grantedBy" TEXT;

-- 3. Снимок тарифа и скидки в платеже ----------------------------------------
ALTER TABLE "subscription_payments" ADD COLUMN "planCode" TEXT;
ALTER TABLE "subscription_payments" ADD COLUMN "listPrice" DECIMAL(65,30);
ALTER TABLE "subscription_payments" ADD COLUMN "discountAmount" DECIMAL(65,30);

-- Заполняем снимки для уже существующих платежей: код тарифа берём из подписки,
-- скидку — из фактической записи об использовании промокода, цену до скидки
-- восстанавливаем как «сумма платежа + скидка».
UPDATE "subscription_payments" sp
SET "planCode" = s."planType"
FROM "subscriptions" s
WHERE sp."subscriptionId" = s."id";

UPDATE "subscription_payments" sp
SET "discountAmount" = COALESCE(pcu."discountAmount", 0)
FROM "promo_code_usages" pcu
WHERE pcu."subscriptionPaymentId" = sp."id";

UPDATE "subscription_payments"
SET "discountAmount" = 0
WHERE "discountAmount" IS NULL;

UPDATE "subscription_payments"
SET "listPrice" = "amount" + COALESCE("discountAmount", 0)
WHERE "listPrice" IS NULL;

-- 4. История выдачи и продления тарифов --------------------------------------
CREATE TABLE "subscription_grant_logs" (
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

CREATE INDEX "subscription_grant_logs_tenantId_createdAt_idx"
    ON "subscription_grant_logs"("tenantId", "createdAt");

ALTER TABLE "subscription_grant_logs"
    ADD CONSTRAINT "subscription_grant_logs_subscriptionId_fkey"
    FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "subscription_grant_logs"
    ADD CONSTRAINT "subscription_grant_logs_superAdminId_fkey"
    FOREIGN KEY ("superAdminId") REFERENCES "super_admins"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- 5. Путь к файлу логов сервера ----------------------------------------------
ALTER TABLE "super_admin_settings" ADD COLUMN "errorLogPath" TEXT;