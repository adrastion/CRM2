-- One shared limit for additional school staff (ADMIN, PROMOTER, ...).
ALTER TABLE "subscription_plans" ADD COLUMN "maxExtraStaff" INTEGER;

UPDATE "subscription_plans"
SET "maxExtraStaff" = CASE
  WHEN "maxAdmins" IS NULL AND "maxPromoters" IS NULL THEN NULL
  WHEN "maxAdmins" IS NULL THEN "maxPromoters"
  WHEN "maxPromoters" IS NULL THEN "maxAdmins"
  ELSE GREATEST("maxAdmins", "maxPromoters")
END;

ALTER TABLE "subscription_plans" DROP COLUMN "maxAdmins";
ALTER TABLE "subscription_plans" DROP COLUMN "maxPromoters";