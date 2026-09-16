-- Deduplicate promo codes (keep oldest active; suffix others)
WITH ranked AS (
  SELECT id, code,
    ROW_NUMBER() OVER (PARTITION BY UPPER(code) ORDER BY "createdAt" ASC) AS rn
  FROM promo_codes
)
UPDATE promo_codes p
SET code = p.code || '-DUP' || SUBSTRING(p.id, 1, 6),
    "isActive" = false
FROM ranked r
WHERE p.id = r.id AND r.rn > 1;

-- Deduplicate marketer emails (keep oldest)
WITH ranked AS (
  SELECT id, LOWER(email) AS em,
    ROW_NUMBER() OVER (PARTITION BY LOWER(email) ORDER BY "createdAt" ASC) AS rn
  FROM marketers
)
UPDATE marketers m
SET email = m.email || '+dup' || SUBSTRING(m.id, 1, 6)
FROM ranked r
WHERE m.id = r.id AND r.rn > 1;

-- Drop old unique on promo (code, tenantId)
DROP INDEX IF EXISTS "promo_codes_code_tenantId_key";

-- Make Marketer.tenantId nullable; detach from schools
ALTER TABLE "marketers" ALTER COLUMN "tenantId" DROP NOT NULL;
UPDATE "marketers" SET "tenantId" = NULL;
ALTER TABLE "marketers" DROP CONSTRAINT IF EXISTS "marketers_tenantId_fkey";
ALTER TABLE "marketers" ADD CONSTRAINT "marketers_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS "marketers_email_key" ON "marketers"("email");

-- PromoCode: nullable tenantId + global unique code
ALTER TABLE "promo_codes" ALTER COLUMN "tenantId" DROP NOT NULL;
ALTER TABLE "promo_codes" DROP CONSTRAINT IF EXISTS "promo_codes_tenantId_fkey";
ALTER TABLE "promo_codes" ADD CONSTRAINT "promo_codes_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE UNIQUE INDEX IF NOT EXISTS "promo_codes_code_key" ON "promo_codes"("code");

-- ReferralLink: nullable tenantId
ALTER TABLE "referral_links" ALTER COLUMN "tenantId" DROP NOT NULL;
ALTER TABLE "referral_links" DROP CONSTRAINT IF EXISTS "referral_links_tenantId_fkey";
ALTER TABLE "referral_links" ADD CONSTRAINT "referral_links_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ReferralClick: nullable tenantId
ALTER TABLE "referral_clicks" ALTER COLUMN "tenantId" DROP NOT NULL;
ALTER TABLE "referral_clicks" DROP CONSTRAINT IF EXISTS "referral_clicks_tenantId_fkey";
ALTER TABLE "referral_clicks" ADD CONSTRAINT "referral_clicks_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
