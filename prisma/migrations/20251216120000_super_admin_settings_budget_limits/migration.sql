-- Настройки супер-админа и лимиты бюджета (раньше в add_admin_features.sql создавались только budget_limits без super_admin_settings)

CREATE TABLE IF NOT EXISTS "super_admin_settings" (
    "id" TEXT NOT NULL,
    "reservePercentage" DECIMAL(65,30),
    "reserveAmount" DECIMAL(65,30),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "super_admin_settings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "budget_limits" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT,
    "categoryName" TEXT,
    "limitAmount" DECIMAL(65,30) NOT NULL,
    "period" TEXT NOT NULL,
    "currentSpent" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "settingsId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "budget_limits_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "budget_limits" ADD CONSTRAINT "budget_limits_settingsId_fkey"
    FOREIGN KEY ("settingsId") REFERENCES "super_admin_settings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
