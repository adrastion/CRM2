-- Per-user interactive onboarding flags
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "hasCompletedOnboarding" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "onboardingDeclined" BOOLEAN NOT NULL DEFAULT false;
