-- Sync all columns that exist in Prisma schema but were never added by migrations.
-- Idempotent: ADD COLUMN IF NOT EXISTS so safe to run on any DB state.

-- clients (balance + passport/membership fee fields)
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "balance" DECIMAL(65,30) NOT NULL DEFAULT 0;
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "birthCertificate" TEXT;
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "medicalCertificate" TEXT;
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "weight" DECIMAL(65,30);
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "membershipFeePaid" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "membershipFeePaidAt" TIMESTAMP(3);
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "membershipFeePaidBy" TEXT;
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "passportBirthPlace" TEXT;
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "passportDivisionCode" TEXT;
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "passportIssueDate" TIMESTAMP(3);
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "passportIssuedBy" TEXT;
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "passportNumber" TEXT;
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "passportSeries" TEXT;

-- attendances
ALTER TABLE "attendances" ADD COLUMN IF NOT EXISTS "shouldCharge" BOOLEAN NOT NULL DEFAULT true;

-- marketers
ALTER TABLE "marketers" ADD COLUMN IF NOT EXISTS "balance" DECIMAL(65,30) NOT NULL DEFAULT 0;
ALTER TABLE "marketers" ADD COLUMN IF NOT EXISTS "commissionPercentage" DECIMAL(65,30) NOT NULL DEFAULT 10;

-- promo_code_usages
ALTER TABLE "promo_code_usages" ADD COLUMN IF NOT EXISTS "subscriptionPaymentId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "promo_code_usages_subscriptionPaymentId_key" ON "promo_code_usages"("subscriptionPaymentId");
ALTER TABLE "promo_code_usages" DROP CONSTRAINT IF EXISTS "promo_code_usages_subscriptionPaymentId_fkey";
ALTER TABLE "promo_code_usages" ADD CONSTRAINT "promo_code_usages_subscriptionPaymentId_fkey" FOREIGN KEY ("subscriptionPaymentId") REFERENCES "subscription_payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- subscriptions
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "nextPlanType" TEXT;
