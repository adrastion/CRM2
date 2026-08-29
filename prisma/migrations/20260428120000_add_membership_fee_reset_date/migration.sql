-- Добавляет отсутствующую колонку `membershipFeeResetDate`.
--
-- Колонка описана в prisma/schema.prisma (модель TenantSettings) и используется
-- в settingsController, но соответствующей миграции не было — из-за этого любой
-- запрос к tenant_settings падал с ошибкой Prisma P2022.
--
-- Операция безопасная: колонка nullable, существующие строки не затрагиваются.
ALTER TABLE "tenant_settings"
  ADD COLUMN IF NOT EXISTS "membershipFeeResetDate" TEXT;
