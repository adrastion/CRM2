-- Remove email confirmation fields from parents table
ALTER TABLE "parents" DROP COLUMN IF EXISTS "approvalToken";
ALTER TABLE "parents" DROP COLUMN IF EXISTS "approvalTokenExpiresAt";
-- Set isApproved default to true for existing parents
ALTER TABLE "parents" ALTER COLUMN "isApproved" SET DEFAULT true;
UPDATE "parents" SET "isApproved" = true WHERE "isApproved" = false;
