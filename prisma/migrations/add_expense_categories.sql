-- Create expense_categories table
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

-- Create unique index on name
CREATE UNIQUE INDEX IF NOT EXISTS "expense_categories_name_key" ON "expense_categories"("name");

-- Add categoryId column to admin_transactions
ALTER TABLE "admin_transactions" ADD COLUMN IF NOT EXISTS "categoryId" TEXT;

-- Add foreign key constraint
ALTER TABLE "admin_transactions" ADD CONSTRAINT IF NOT EXISTS "admin_transactions_categoryId_fkey" 
    FOREIGN KEY ("categoryId") REFERENCES "expense_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Insert default categories
INSERT INTO "expense_categories" ("id", "name", "description", "color", "isActive", "createdAt", "updatedAt")
VALUES 
    ('cat_server', 'Сервер и хостинг', 'Расходы на сервер, хостинг, облачные услуги', '#FF5722', true, NOW(), NOW()),
    ('cat_development', 'Разработка и поддержка', 'Расходы на разработку и техническую поддержку', '#2196F3', true, NOW(), NOW()),
    ('cat_marketing', 'Маркетинг и реклама', 'Расходы на маркетинг и рекламу', '#9C27B0', true, NOW(), NOW()),
    ('cat_salary', 'Зарплаты сотрудников', 'Зарплаты сотрудников платформы', '#4CAF50', true, NOW(), NOW()),
    ('cat_taxes', 'Налоги и сборы', 'Налоги и различные сборы', '#FF9800', true, NOW(), NOW()),
    ('cat_other', 'Прочее', 'Прочие расходы', '#607D8B', true, NOW(), NOW())
ON CONFLICT ("name") DO NOTHING;

