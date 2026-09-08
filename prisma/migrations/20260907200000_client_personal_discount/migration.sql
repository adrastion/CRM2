-- Personal discount on Client for monthly payments
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "personalDiscountType" TEXT;
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "personalDiscountValue" DECIMAL(65,30);
