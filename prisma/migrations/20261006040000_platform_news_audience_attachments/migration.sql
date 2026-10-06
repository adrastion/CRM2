-- AlterTable
ALTER TABLE "platform_changelog_entries" ADD COLUMN IF NOT EXISTS "audienceRoles" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "platform_changelog_entries" ADD COLUMN IF NOT EXISTS "imageUrl" TEXT;
ALTER TABLE "platform_changelog_entries" ADD COLUMN IF NOT EXISTS "fileUrl" TEXT;

-- Existing entries: only Super Admin and Tester
UPDATE "platform_changelog_entries"
SET "audienceRoles" = ARRAY['SUPER_ADMIN', 'TESTER']::TEXT[]
WHERE "audienceRoles" IS NULL OR cardinality("audienceRoles") = 0;
