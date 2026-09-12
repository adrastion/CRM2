-- AlterEnum
ALTER TYPE "ChatThreadType" ADD VALUE IF NOT EXISTS 'STAFF_TASK';

-- AlterTable
ALTER TABLE "notification_preferences" ADD COLUMN IF NOT EXISTS "taskRemindersEnabled" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "chat_threads" ADD COLUMN IF NOT EXISTS "staffTaskId" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "staff_notes" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "visibility" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "staff_tasks" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "remindBeforeSentAt" TIMESTAMP(3),
    "overdueNotifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "staff_task_assignees" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_task_assignees_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "staff_notes_tenantId_visibility_idx" ON "staff_notes"("tenantId", "visibility");
CREATE INDEX IF NOT EXISTS "staff_notes_authorUserId_visibility_idx" ON "staff_notes"("authorUserId", "visibility");
CREATE INDEX IF NOT EXISTS "staff_tasks_tenantId_status_dueAt_idx" ON "staff_tasks"("tenantId", "status", "dueAt");
CREATE INDEX IF NOT EXISTS "staff_tasks_createdByUserId_idx" ON "staff_tasks"("createdByUserId");
CREATE UNIQUE INDEX IF NOT EXISTS "staff_task_assignees_taskId_userId_key" ON "staff_task_assignees"("taskId", "userId");
CREATE INDEX IF NOT EXISTS "staff_task_assignees_userId_idx" ON "staff_task_assignees"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "chat_threads_staffTaskId_key" ON "chat_threads"("staffTaskId");

DO $$ BEGIN
  ALTER TABLE "staff_notes" ADD CONSTRAINT "staff_notes_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "staff_notes" ADD CONSTRAINT "staff_notes_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "staff_tasks" ADD CONSTRAINT "staff_tasks_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "staff_tasks" ADD CONSTRAINT "staff_tasks_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "staff_task_assignees" ADD CONSTRAINT "staff_task_assignees_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "staff_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "staff_task_assignees" ADD CONSTRAINT "staff_task_assignees_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "chat_threads" ADD CONSTRAINT "chat_threads_staffTaskId_fkey" FOREIGN KEY ("staffTaskId") REFERENCES "staff_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
