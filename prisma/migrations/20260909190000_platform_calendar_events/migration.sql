-- CreateEnum
CREATE TYPE "PlatformEventIntervalUnit" AS ENUM ('NONE', 'DAY', 'WEEK', 'MONTH', 'YEAR');

-- CreateTable
CREATE TABLE "platform_calendar_events" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "startAt" TIMESTAMP(3) NOT NULL,
    "allDay" BOOLEAN NOT NULL DEFAULT true,
    "intervalUnit" "PlatformEventIntervalUnit" NOT NULL DEFAULT 'NONE',
    "intervalCount" INTEGER NOT NULL DEFAULT 1,
    "seriesEndAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_calendar_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "platform_calendar_events_startAt_idx" ON "platform_calendar_events"("startAt");
CREATE INDEX "platform_calendar_events_intervalUnit_startAt_idx" ON "platform_calendar_events"("intervalUnit", "startAt");

ALTER TABLE "platform_calendar_events"
ADD CONSTRAINT "platform_calendar_events_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "super_admins"("id") ON DELETE CASCADE ON UPDATE CASCADE;
