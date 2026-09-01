-- Дата ежегодного сброса флага membershipFeePaid у клиентов школы (формат MM-DD).

ALTER TABLE "tenant_settings"
    ADD COLUMN IF NOT EXISTS "membershipFeeResetDate" TEXT;
