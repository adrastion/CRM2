ALTER TABLE "staff_tasks" ADD COLUMN IF NOT EXISTS "projectKey" TEXT NOT NULL DEFAULT 'general';
ALTER TABLE "staff_tasks" ADD COLUMN IF NOT EXISTS "favorite" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "staff_tasks" ADD COLUMN IF NOT EXISTS "archived" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "staff_tasks" ADD COLUMN IF NOT EXISTS "recurrence" TEXT NOT NULL DEFAULT 'none';

CREATE TABLE IF NOT EXISTS "staff_task_attachments" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "staff_task_attachments_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "staff_task_attachments_taskId_idx" ON "staff_task_attachments"("taskId");

CREATE TABLE IF NOT EXISTS "staff_task_comments" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "staff_task_comments_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "staff_task_comments_taskId_createdAt_idx" ON "staff_task_comments"("taskId", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'staff_task_attachments_taskId_fkey') THEN
    ALTER TABLE "staff_task_attachments" ADD CONSTRAINT "staff_task_attachments_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "staff_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'staff_task_attachments_createdById_fkey') THEN
    ALTER TABLE "staff_task_attachments" ADD CONSTRAINT "staff_task_attachments_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'staff_task_comments_taskId_fkey') THEN
    ALTER TABLE "staff_task_comments" ADD CONSTRAINT "staff_task_comments_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "staff_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'staff_task_comments_authorId_fkey') THEN
    ALTER TABLE "staff_task_comments" ADD CONSTRAINT "staff_task_comments_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;