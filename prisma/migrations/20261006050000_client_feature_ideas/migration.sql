-- CreateEnum
CREATE TYPE "ClientFeatureIdeaStatus" AS ENUM ('SUBMITTED', 'ACCEPTED', 'REJECTED');

-- CreateTable
CREATE TABLE "client_feature_ideas" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "ClientFeatureIdeaStatus" NOT NULL DEFAULT 'SUBMITTED',
    "actorType" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "tenantId" TEXT,
    "authorName" TEXT,
    "authorEmail" TEXT,
    "tenantName" TEXT,
    "devNoteId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "rejectReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_feature_ideas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "client_feature_ideas_devNoteId_key" ON "client_feature_ideas"("devNoteId");

-- CreateIndex
CREATE INDEX "client_feature_ideas_status_createdAt_idx" ON "client_feature_ideas"("status", "createdAt");

-- CreateIndex
CREATE INDEX "client_feature_ideas_actorType_actorId_createdAt_idx" ON "client_feature_ideas"("actorType", "actorId", "createdAt");

-- AddForeignKey
ALTER TABLE "client_feature_ideas" ADD CONSTRAINT "client_feature_ideas_devNoteId_fkey" FOREIGN KEY ("devNoteId") REFERENCES "super_admin_dev_notes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_feature_ideas" ADD CONSTRAINT "client_feature_ideas_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "super_admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;
