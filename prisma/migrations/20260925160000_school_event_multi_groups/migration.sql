-- CreateTable
CREATE TABLE "school_event_groups" (
    "id" TEXT NOT NULL,
    "schoolEventId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "school_event_groups_pkey" PRIMARY KEY ("id")
);

-- Migrate existing single groupId → join rows
INSERT INTO "school_event_groups" ("id", "schoolEventId", "groupId", "tenantId", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  se."id",
  se."groupId",
  se."tenantId",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "school_events" se
WHERE se."groupId" IS NOT NULL;

-- CreateIndex
CREATE INDEX "school_event_groups_tenantId_schoolEventId_idx" ON "school_event_groups"("tenantId", "schoolEventId");

-- CreateIndex
CREATE INDEX "school_event_groups_groupId_idx" ON "school_event_groups"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX "school_event_groups_schoolEventId_groupId_key" ON "school_event_groups"("schoolEventId", "groupId");

-- AddForeignKey
ALTER TABLE "school_event_groups" ADD CONSTRAINT "school_event_groups_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "school_event_groups" ADD CONSTRAINT "school_event_groups_schoolEventId_fkey" FOREIGN KEY ("schoolEventId") REFERENCES "school_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "school_event_groups" ADD CONSTRAINT "school_event_groups_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- DropForeignKey
ALTER TABLE "school_events" DROP CONSTRAINT IF EXISTS "school_events_groupId_fkey";

-- AlterTable
ALTER TABLE "school_events" DROP COLUMN IF EXISTS "groupId";
