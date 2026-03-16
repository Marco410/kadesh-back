-- CreateTable (skip if already exists)
CREATE TABLE IF NOT EXISTS "TechLeadSyncLog" (
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

-- CreateIndex (skip if already exists)
CREATE INDEX IF NOT EXISTS "TechLeadSyncLog_user_idx" ON "TechLeadSyncLog"("user");
CREATE INDEX IF NOT EXISTS "TechLeadSyncLog_company_idx" ON "TechLeadSyncLog"("company");

-- AddForeignKey (skip if constraint already exists)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TechLeadSyncLog_user_fkey') THEN
        ALTER TABLE "TechLeadSyncLog" ADD CONSTRAINT "TechLeadSyncLog_user_fkey" FOREIGN KEY ("user") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TechLeadSyncLog_company_fkey') THEN
        ALTER TABLE "TechLeadSyncLog" ADD CONSTRAINT "TechLeadSyncLog_company_fkey" FOREIGN KEY ("company") REFERENCES "SaasCompany"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
