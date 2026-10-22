-- Extended schedule / regional settings for tenant
ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "scheduleConfig" JSONB;
