-- CreateTable
CREATE TABLE "TechLeadSyncLog" (
    "id" TEXT NOT NULL,
    "user" TEXT,
    "company" TEXT,
    "success" BOOLEAN NOT NULL DEFAULT false,
    "message" TEXT NOT NULL DEFAULT '',
    "created" INTEGER DEFAULT 0,
    "alreadyInDb" INTEGER DEFAULT 0,
    "skippedLowRating" INTEGER DEFAULT 0,
    "syncedLeadsCount" INTEGER DEFAULT 0,
    "syncedCount" INTEGER,
    "leadLimit" INTEGER,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "radius" DOUBLE PRECISION,
    "category" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TechLeadSyncLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TechLeadSyncLog_user_idx" ON "TechLeadSyncLog"("user");

-- CreateIndex
CREATE INDEX "TechLeadSyncLog_company_idx" ON "TechLeadSyncLog"("company");

-- AddForeignKey
ALTER TABLE "TechLeadSyncLog" ADD CONSTRAINT "TechLeadSyncLog_user_fkey" FOREIGN KEY ("user") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechLeadSyncLog" ADD CONSTRAINT "TechLeadSyncLog_company_fkey" FOREIGN KEY ("company") REFERENCES "SaasCompany"("id") ON DELETE SET NULL ON UPDATE CASCADE;
