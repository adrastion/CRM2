-- Таблицы для супер-админского дашборда (раньше частично были только в add_*.sql вне migrate deploy)

-- 1) tenant_marketers
CREATE TABLE IF NOT EXISTS "tenant_marketers" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "marketerId" TEXT NOT NULL,
    "commissionPercentage" DECIMAL(65,30) NOT NULL DEFAULT 10,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_marketers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "tenant_marketers_tenantId_key" ON "tenant_marketers"("tenantId");

DO $$ BEGIN
  ALTER TABLE "tenant_marketers" ADD CONSTRAINT "tenant_marketers_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "tenant_marketers" ADD CONSTRAINT "tenant_marketers_marketerId_fkey"
    FOREIGN KEY ("marketerId") REFERENCES "marketers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2) expense_categories (до admin_transactions: FK categoryId)
CREATE TABLE IF NOT EXISTS "expense_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expense_categories_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "expense_categories_name_key" ON "expense_categories"("name");

INSERT INTO "expense_categories" ("id", "name", "description", "color", "isActive", "createdAt", "updatedAt")
VALUES
    ('cat_server', 'Сервер и хостинг', 'Расходы на сервер, хостинг, облачные услуги', '#FF5722', true, NOW(), NOW()),
    ('cat_development', 'Разработка и поддержка', 'Расходы на разработку и техническую поддержку', '#2196F3', true, NOW(), NOW()),
    ('cat_marketing', 'Маркетинг и реклама', 'Расходы на маркетинг и рекламу', '#9C27B0', true, NOW(), NOW()),
    ('cat_salary', 'Зарплаты сотрудников', 'Зарплаты сотрудников платформы', '#4CAF50', true, NOW(), NOW()),
    ('cat_taxes', 'Налоги и сборы', 'Налоги и различные сборы', '#FF9800', true, NOW(), NOW()),
    ('cat_other', 'Прочее', 'Прочие расходы', '#607D8B', true, NOW(), NOW())
ON CONFLICT ("name") DO NOTHING;

-- 3) admin_transactions (в пронумерованных миграциях раньше не создавалась — только ALTER в add_*.sql)
CREATE TABLE IF NOT EXISTS "admin_transactions" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "description" TEXT NOT NULL,
    "marketerId" TEXT,
    "superAdminId" TEXT,
    "categoryId" TEXT,
    "documentUrl" TEXT,
    "isRecurring" BOOLEAN NOT NULL DEFAULT false,
    "recurringPeriod" TEXT,
    "nextDueDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_transactions_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "admin_transactions" ADD CONSTRAINT "admin_transactions_marketerId_fkey"
    FOREIGN KEY ("marketerId") REFERENCES "marketers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "admin_transactions" ADD CONSTRAINT "admin_transactions_superAdminId_fkey"
    FOREIGN KEY ("superAdminId") REFERENCES "super_admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "admin_transactions" ADD CONSTRAINT "admin_transactions_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "expense_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 4) dashboard_presets
CREATE TABLE IF NOT EXISTS "dashboard_presets" (
    "id" TEXT NOT NULL,
    "superAdminId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "widgetOrder" TEXT NOT NULL,
    "widgetVisibility" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dashboard_presets_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "dashboard_presets" ADD CONSTRAINT "dashboard_presets_superAdminId_fkey"
    FOREIGN KEY ("superAdminId") REFERENCES "super_admins"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
