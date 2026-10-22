ALTER TABLE "staff_notes" ADD COLUMN IF NOT EXISTS "color" TEXT;
ALTER TABLE "staff_notes" ADD COLUMN IF NOT EXISTS "pinned" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "staff_notes" ADD COLUMN IF NOT EXISTS "tags" TEXT;
ALTER TABLE "staff_notes" ADD COLUMN IF NOT EXISTS "relatedTaskIds" TEXT;

CREATE TABLE IF NOT EXISTS "staff_note_attachments" (
    "id" TEXT NOT NULL,
    "noteId" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "staff_note_attachments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "staff_note_attachments_noteId_idx" ON "staff_note_attachments"("noteId");
CREATE INDEX IF NOT EXISTS "staff_notes_tenantId_pinned_idx" ON "staff_notes"("tenantId", "pinned");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'staff_note_attachments_noteId_fkey') THEN
    ALTER TABLE "staff_note_attachments" ADD CONSTRAINT "staff_note_attachments_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "staff_notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'staff_note_attachments_createdById_fkey') THEN
    ALTER TABLE "staff_note_attachments" ADD CONSTRAINT "staff_note_attachments_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;