-- AlterTable TenantSettings
ALTER TABLE "tenant_settings" ADD COLUMN "chatMessageDeleteLimitMinutes" INTEGER NOT NULL DEFAULT 15;

-- AlterTable SuperAdminSettings
ALTER TABLE "super_admin_settings" ADD COLUMN "platformChatMessageDeleteLimitMinutes" INTEGER NOT NULL DEFAULT 15;

-- AlterTable ChatMessage
ALTER TABLE "chat_messages" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "chat_messages" ADD COLUMN "deletedByType" TEXT;
ALTER TABLE "chat_messages" ADD COLUMN "deletedById" TEXT;

-- CreateIndex
CREATE INDEX "chat_messages_threadId_deletedAt_idx" ON "chat_messages"("threadId", "deletedAt");
