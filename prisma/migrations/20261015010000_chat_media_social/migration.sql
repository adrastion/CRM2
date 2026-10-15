-- AlterTable
ALTER TABLE "chat_messages" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'TEXT';
ALTER TABLE "chat_messages" ADD COLUMN "replyToMessageId" TEXT;

-- CreateTable
CREATE TABLE "chat_attachments" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "durationMs" INTEGER,
    "width" INTEGER,
    "height" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_mentions" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "mentionedType" TEXT NOT NULL,
    "mentionedId" TEXT NOT NULL,

    CONSTRAINT "chat_mentions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_thread_pins" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "pinnedByType" TEXT NOT NULL,
    "pinnedById" TEXT NOT NULL,
    "pinnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_thread_pins_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "chat_messages_replyToMessageId_idx" ON "chat_messages"("replyToMessageId");

-- CreateIndex
CREATE INDEX "chat_attachments_messageId_idx" ON "chat_attachments"("messageId");

-- CreateIndex
CREATE INDEX "chat_mentions_mentionedType_mentionedId_idx" ON "chat_mentions"("mentionedType", "mentionedId");

-- CreateIndex
CREATE UNIQUE INDEX "chat_mentions_messageId_mentionedType_mentionedId_key" ON "chat_mentions"("messageId", "mentionedType", "mentionedId");

-- CreateIndex
CREATE INDEX "chat_thread_pins_threadId_pinnedAt_idx" ON "chat_thread_pins"("threadId", "pinnedAt");

-- CreateIndex
CREATE UNIQUE INDEX "chat_thread_pins_threadId_messageId_key" ON "chat_thread_pins"("threadId", "messageId");

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_replyToMessageId_fkey" FOREIGN KEY ("replyToMessageId") REFERENCES "chat_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_attachments" ADD CONSTRAINT "chat_attachments_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "chat_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_mentions" ADD CONSTRAINT "chat_mentions_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "chat_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_thread_pins" ADD CONSTRAINT "chat_thread_pins_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "chat_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_thread_pins" ADD CONSTRAINT "chat_thread_pins_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "chat_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
