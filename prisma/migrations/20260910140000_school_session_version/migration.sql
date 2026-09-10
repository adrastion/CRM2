-- Отзыв JWT школьных аккаунтов при смене пароля / деактивации
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "sessionVersion" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "sessionVersion" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "parents" ADD COLUMN IF NOT EXISTS "sessionVersion" INTEGER NOT NULL DEFAULT 0;
