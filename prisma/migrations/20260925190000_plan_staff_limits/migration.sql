-- Staff role limits on subscription plans.
-- NULL = unlimited (existing plans stay unlimited until SA sets a number).

ALTER TABLE "subscription_plans" ADD COLUMN "maxAdmins" INTEGER;
ALTER TABLE "subscription_plans" ADD COLUMN "maxPromoters" INTEGER;