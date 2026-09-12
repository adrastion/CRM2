-- CreateTable
CREATE TABLE "site_visit_sessions" (
    "id" TEXT NOT NULL,
    "visitorId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "lastPath" TEXT,
    "actorHint" TEXT,
    "pingCount" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "site_visit_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site_visit_daily" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "uniqueVisitors" INTEGER NOT NULL DEFAULT 0,
    "sessionCount" INTEGER NOT NULL DEFAULT 0,
    "totalDurationSec" INTEGER NOT NULL DEFAULT 0,
    "peakConcurrent" INTEGER NOT NULL DEFAULT 0,
    "hourlyJson" TEXT NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "site_visit_daily_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "site_visit_sessions_lastSeenAt_idx" ON "site_visit_sessions"("lastSeenAt");

-- CreateIndex
CREATE INDEX "site_visit_sessions_visitorId_startedAt_idx" ON "site_visit_sessions"("visitorId", "startedAt");

-- CreateIndex
CREATE INDEX "site_visit_sessions_endedAt_lastSeenAt_idx" ON "site_visit_sessions"("endedAt", "lastSeenAt");

-- CreateIndex
CREATE UNIQUE INDEX "site_visit_daily_date_key" ON "site_visit_daily"("date");

-- CreateIndex
CREATE INDEX "site_visit_daily_date_idx" ON "site_visit_daily"("date");
