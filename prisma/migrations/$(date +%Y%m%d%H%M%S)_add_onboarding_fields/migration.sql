-- AlterTable
ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "hasCompletedOnboarding" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "onboardingDeclined" BOOLEAN NOT NULL DEFAULT false;

