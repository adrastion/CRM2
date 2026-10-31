-- AlterTable
ALTER TABLE "support_tickets" ADD COLUMN "staffLastReadAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "support_knowledge_articles" ADD COLUMN "audience" TEXT NOT NULL DEFAULT 'all';
ALTER TABLE "support_knowledge_articles" ADD COLUMN "hint" TEXT;
ALTER TABLE "support_knowledge_articles" ADD COLUMN "topic" TEXT;
ALTER TABLE "support_knowledge_articles" ADD COLUMN "iconKey" TEXT;

-- CreateIndex
CREATE INDEX "support_knowledge_articles_isActive_audience_sortOrder_idx" ON "support_knowledge_articles"("isActive", "audience", "sortOrder");

-- CreateTable
CREATE TABLE "support_canned_replies" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_canned_replies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "support_canned_replies_isActive_sortOrder_idx" ON "support_canned_replies"("isActive", "sortOrder");
