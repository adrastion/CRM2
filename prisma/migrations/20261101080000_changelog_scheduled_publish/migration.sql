-- AlterTable
ALTER TABLE "platform_changelog_entries" ADD COLUMN "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "platform_changelog_entries" ADD COLUMN "pushSentAt" TIMESTAMP(3);

-- Backfill: существующие новости уже «опубликованы» и push считать отправленным
UPDATE "platform_changelog_entries"
SET "publishedAt" = "createdAt",
    "pushSentAt" = "createdAt"
WHERE "pushSentAt" IS NULL;

-- CreateIndex
CREATE INDEX "platform_changelog_entries_publishedAt_idx" ON "platform_changelog_entries"("publishedAt");
