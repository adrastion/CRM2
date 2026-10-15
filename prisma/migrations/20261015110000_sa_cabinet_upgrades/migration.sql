-- AlterEnum
ALTER TYPE "DevNoteStatus" ADD VALUE IF NOT EXISTS 'REQUIRED';
ALTER TYPE "DevNoteStatus" ADD VALUE IF NOT EXISTS 'AWAITING_FEEDBACK';
ALTER TYPE "DevNoteStatus" ADD VALUE IF NOT EXISTS 'LIKE_OTHERS';

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "DevNotePriority" AS ENUM ('URGENT', 'IMPORTANT');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AlterTable
ALTER TABLE "super_admin_dev_notes"
  ADD COLUMN IF NOT EXISTS "priority" "DevNotePriority",
  ADD COLUMN IF NOT EXISTS "lastEditedById" TEXT,
  ADD COLUMN IF NOT EXISTS "doneAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "activityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "dueFrom" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "dueTo" TIMESTAMP(3);

UPDATE "super_admin_dev_notes" SET "activityAt" = "updatedAt" WHERE "activityAt" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "super_admin_dev_notes_archivedAt_idx" ON "super_admin_dev_notes"("archivedAt");
CREATE INDEX IF NOT EXISTS "super_admin_dev_notes_deletedAt_idx" ON "super_admin_dev_notes"("deletedAt");

ALTER TABLE "super_admin_dev_notes"
  DROP CONSTRAINT IF EXISTS "super_admin_dev_notes_lastEditedById_fkey";
ALTER TABLE "super_admin_dev_notes"
  ADD CONSTRAINT "super_admin_dev_notes_lastEditedById_fkey"
  FOREIGN KEY ("lastEditedById") REFERENCES "super_admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "super_admin_dev_note_comments" (
  "id" TEXT NOT NULL,
  "noteId" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "super_admin_dev_note_comments_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "super_admin_dev_note_comments_noteId_createdAt_idx" ON "super_admin_dev_note_comments"("noteId", "createdAt");
ALTER TABLE "super_admin_dev_note_comments" DROP CONSTRAINT IF EXISTS "super_admin_dev_note_comments_noteId_fkey";
ALTER TABLE "super_admin_dev_note_comments" ADD CONSTRAINT "super_admin_dev_note_comments_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "super_admin_dev_notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "super_admin_dev_note_comments" DROP CONSTRAINT IF EXISTS "super_admin_dev_note_comments_authorId_fkey";
ALTER TABLE "super_admin_dev_note_comments" ADD CONSTRAINT "super_admin_dev_note_comments_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "super_admins"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "super_admin_dev_note_reads" (
  "noteId" TEXT NOT NULL,
  "superAdminId" TEXT NOT NULL,
  "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "super_admin_dev_note_reads_pkey" PRIMARY KEY ("noteId","superAdminId")
);
ALTER TABLE "super_admin_dev_note_reads" DROP CONSTRAINT IF EXISTS "super_admin_dev_note_reads_noteId_fkey";
ALTER TABLE "super_admin_dev_note_reads" ADD CONSTRAINT "super_admin_dev_note_reads_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "super_admin_dev_notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "super_admin_dev_note_reads" DROP CONSTRAINT IF EXISTS "super_admin_dev_note_reads_superAdminId_fkey";
ALTER TABLE "super_admin_dev_note_reads" ADD CONSTRAINT "super_admin_dev_note_reads_superAdminId_fkey" FOREIGN KEY ("superAdminId") REFERENCES "super_admins"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "super_admin_notifications" (
  "id" TEXT NOT NULL,
  "recipientId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "link" TEXT,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "super_admin_notifications_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "super_admin_notifications_recipientId_readAt_createdAt_idx" ON "super_admin_notifications"("recipientId", "readAt", "createdAt");
ALTER TABLE "super_admin_notifications" DROP CONSTRAINT IF EXISTS "super_admin_notifications_recipientId_fkey";
ALTER TABLE "super_admin_notifications" ADD CONSTRAINT "super_admin_notifications_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "super_admins"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "planned_expenses" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "amount" DECIMAL(65,30) NOT NULL,
  "dueDate" TIMESTAMP(3) NOT NULL,
  "payeeKind" TEXT NOT NULL,
  "payeeName" TEXT,
  "marketerId" TEXT,
  "comment" TEXT,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "planned_expenses_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "planned_expenses_dueDate_idx" ON "planned_expenses"("dueDate");
ALTER TABLE "planned_expenses" DROP CONSTRAINT IF EXISTS "planned_expenses_createdById_fkey";
ALTER TABLE "planned_expenses" ADD CONSTRAINT "planned_expenses_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "super_admins"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "planned_expenses" DROP CONSTRAINT IF EXISTS "planned_expenses_marketerId_fkey";
ALTER TABLE "planned_expenses" ADD CONSTRAINT "planned_expenses_marketerId_fkey" FOREIGN KEY ("marketerId") REFERENCES "marketers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "super_admin_test_sessions" (
  "id" TEXT NOT NULL,
  "superAdminId" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "storageKey" TEXT NOT NULL,
  "dashboardPath" TEXT NOT NULL,
  "saved" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "super_admin_test_sessions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "super_admin_test_sessions_superAdminId_role_idx" ON "super_admin_test_sessions"("superAdminId", "role");
ALTER TABLE "super_admin_test_sessions" DROP CONSTRAINT IF EXISTS "super_admin_test_sessions_superAdminId_fkey";
ALTER TABLE "super_admin_test_sessions" ADD CONSTRAINT "super_admin_test_sessions_superAdminId_fkey" FOREIGN KEY ("superAdminId") REFERENCES "super_admins"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "super_admin_settings" ADD COLUMN IF NOT EXISTS "maintenanceScheduledAt" TIMESTAMP(3);
