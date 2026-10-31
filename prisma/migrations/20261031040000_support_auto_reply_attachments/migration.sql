-- CreateTable
CREATE TABLE "support_auto_reply_attachments" (
    "id" TEXT NOT NULL,
    "promoId" TEXT,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "storagePath" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_auto_reply_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "support_auto_reply_attachments_promoId_idx" ON "support_auto_reply_attachments"("promoId");

-- AddForeignKey
ALTER TABLE "support_auto_reply_attachments" ADD CONSTRAINT "support_auto_reply_attachments_promoId_fkey" FOREIGN KEY ("promoId") REFERENCES "support_promos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
