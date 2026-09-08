-- CreateEnum
CREATE TYPE "DevNoteStatus" AS ENUM ('IDEA', 'IN_PROGRESS', 'DONE');

-- AlterTable
ALTER TABLE "super_admins" ADD COLUMN "linkedUserId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "super_admins_linkedUserId_key" ON "super_admins"("linkedUserId");

-- AddForeignKey
ALTER TABLE "super_admins" ADD CONSTRAINT "super_admins_linkedUserId_fkey" FOREIGN KEY ("linkedUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "super_admin_dev_notes" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "DevNoteStatus" NOT NULL DEFAULT 'IDEA',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "super_admin_dev_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "super_admin_dev_notes_status_updatedAt_idx" ON "super_admin_dev_notes"("status", "updatedAt");

-- AddForeignKey
ALTER TABLE "super_admin_dev_notes" ADD CONSTRAINT "super_admin_dev_notes_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "super_admins"("id") ON DELETE CASCADE ON UPDATE CASCADE;
