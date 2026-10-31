-- AlterTable marketers: profile + onboarding
ALTER TABLE "marketers" ADD COLUMN IF NOT EXISTS "firstName" TEXT;
ALTER TABLE "marketers" ADD COLUMN IF NOT EXISTS "lastName" TEXT;
ALTER TABLE "marketers" ADD COLUMN IF NOT EXISTS "inn" TEXT;
ALTER TABLE "marketers" ADD COLUMN IF NOT EXISTS "taxStatus" TEXT NOT NULL DEFAULT 'UNKNOWN';
ALTER TABLE "marketers" ADD COLUMN IF NOT EXISTS "taxStatusConfirmedAt" TIMESTAMP(3);
ALTER TABLE "marketers" ADD COLUMN IF NOT EXISTS "offerAcceptedAt" TIMESTAMP(3);
ALTER TABLE "marketers" ADD COLUMN IF NOT EXISTS "offerDocVersion" TEXT;
ALTER TABLE "marketers" ADD COLUMN IF NOT EXISTS "pepAcceptedAt" TIMESTAMP(3);
ALTER TABLE "marketers" ADD COLUMN IF NOT EXISTS "pepDocVersion" TEXT;
ALTER TABLE "marketers" ADD COLUMN IF NOT EXISTS "pdnAcceptedAt" TIMESTAMP(3);
ALTER TABLE "marketers" ADD COLUMN IF NOT EXISTS "pdnDocVersion" TEXT;
ALTER TABLE "marketers" ADD COLUMN IF NOT EXISTS "programRulesAcceptedAt" TIMESTAMP(3);
ALTER TABLE "marketers" ADD COLUMN IF NOT EXISTS "programRulesDocVersion" TEXT;
ALTER TABLE "marketers" ADD COLUMN IF NOT EXISTS "onboardingCompletedAt" TIMESTAMP(3);
