-- AlterTable
ALTER TABLE "support_tickets" ADD COLUMN IF NOT EXISTS "kind" TEXT NOT NULL DEFAULT 'GENERAL';
ALTER TABLE "support_tickets" ADD COLUMN IF NOT EXISTS "requesterLastReadAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE IF NOT EXISTS "support_ticket_message_attachments" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "storagePath" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_ticket_message_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "support_ticket_message_attachments_messageId_idx" ON "support_ticket_message_attachments"("messageId");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "support_ticket_message_attachments"
    ADD CONSTRAINT "support_ticket_message_attachments_messageId_fkey"
    FOREIGN KEY ("messageId") REFERENCES "support_ticket_messages"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
