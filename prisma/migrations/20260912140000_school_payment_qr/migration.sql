-- CreateTable
CREATE TABLE "school_payment_methods" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "paymentUrl" TEXT,
    "qrStoragePath" TEXT,
    "mimeType" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "school_payment_methods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "school_payment_method_groups" (
    "methodId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,

    CONSTRAINT "school_payment_method_groups_pkey" PRIMARY KEY ("methodId","groupId")
);

-- CreateTable
CREATE TABLE "school_payment_method_memberships" (
    "methodId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,

    CONSTRAINT "school_payment_method_memberships_pkey" PRIMARY KEY ("methodId","membershipId")
);

-- CreateTable
CREATE TABLE "payment_receipts" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "claimedAmount" DECIMAL(65,30) NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedByKind" TEXT NOT NULL,
    "submittedById" TEXT NOT NULL,
    "reviewedAt" TIMESTAMP(3),
    "reviewedByUserId" TEXT,

    CONSTRAINT "payment_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "school_payment_methods_tenantId_isActive_idx" ON "school_payment_methods"("tenantId", "isActive");

-- CreateIndex
CREATE INDEX "school_payment_method_groups_groupId_idx" ON "school_payment_method_groups"("groupId");

-- CreateIndex
CREATE INDEX "school_payment_method_memberships_membershipId_idx" ON "school_payment_method_memberships"("membershipId");

-- CreateIndex
CREATE UNIQUE INDEX "payment_receipts_paymentId_key" ON "payment_receipts"("paymentId");

-- CreateIndex
CREATE INDEX "payment_receipts_submittedAt_idx" ON "payment_receipts"("submittedAt");

-- AddForeignKey
ALTER TABLE "school_payment_methods" ADD CONSTRAINT "school_payment_methods_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "school_payment_method_groups" ADD CONSTRAINT "school_payment_method_groups_methodId_fkey" FOREIGN KEY ("methodId") REFERENCES "school_payment_methods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "school_payment_method_groups" ADD CONSTRAINT "school_payment_method_groups_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "school_payment_method_memberships" ADD CONSTRAINT "school_payment_method_memberships_methodId_fkey" FOREIGN KEY ("methodId") REFERENCES "school_payment_methods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "school_payment_method_memberships" ADD CONSTRAINT "school_payment_method_memberships_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_receipts" ADD CONSTRAINT "payment_receipts_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_receipts" ADD CONSTRAINT "payment_receipts_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
