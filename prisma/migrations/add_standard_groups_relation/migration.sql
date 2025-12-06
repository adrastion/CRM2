-- CreateTable
CREATE TABLE "standard_groups" (
    "id" TEXT NOT NULL,
    "standardId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "standard_groups_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "standard_groups_standardId_groupId_key" ON "standard_groups"("standardId", "groupId");

-- AddForeignKey
ALTER TABLE "standard_groups" ADD CONSTRAINT "standard_groups_standardId_fkey" FOREIGN KEY ("standardId") REFERENCES "standards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "standard_groups" ADD CONSTRAINT "standard_groups_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

