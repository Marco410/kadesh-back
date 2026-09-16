-- AlterTable
ALTER TABLE "TechBusinessLead" ADD COLUMN     "sourceEstablishment" TEXT;

-- CreateTable
CREATE TABLE "TechInegiEconomicActivity" (
    "id" TEXT NOT NULL,
    "scianCode" TEXT NOT NULL DEFAULT '',
    "name" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "TechInegiEconomicActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TechInegiEstablishment" (
    "id" TEXT NOT NULL,
    "clee" TEXT NOT NULL DEFAULT '',
    "name" TEXT NOT NULL DEFAULT '',
    "legalName" TEXT NOT NULL DEFAULT '',
    "employeeStratum" TEXT NOT NULL DEFAULT '',
    "economicActivity" TEXT,
    "street" TEXT NOT NULL DEFAULT '',
    "exteriorNumber" TEXT NOT NULL DEFAULT '',
    "interiorNumber" TEXT NOT NULL DEFAULT '',
    "neighborhood" TEXT NOT NULL DEFAULT '',
    "postalCode" TEXT NOT NULL DEFAULT '',
    "locality" TEXT NOT NULL DEFAULT '',
    "municipality" TEXT NOT NULL DEFAULT '',
    "state" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "website" TEXT NOT NULL DEFAULT '',
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "rawPayload" JSONB,
    "lastSyncedAt" TIMESTAMP(3),

    CONSTRAINT "TechInegiEstablishment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TechInegiGeoBoundary" (
    "id" TEXT NOT NULL,
    "cacheKey" TEXT NOT NULL DEFAULT '',
    "level" TEXT NOT NULL,
    "geoCode" TEXT NOT NULL DEFAULT '',
    "name" TEXT NOT NULL DEFAULT '',
    "parentCode" TEXT,
    "geometry" JSONB,

    CONSTRAINT "TechInegiGeoBoundary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TechInegiIndicator" (
    "id" TEXT NOT NULL,
    "cacheKey" TEXT NOT NULL DEFAULT '',
    "indicatorId" TEXT NOT NULL DEFAULT '',
    "indicatorName" TEXT NOT NULL DEFAULT '',
    "geographicLevel" TEXT NOT NULL,
    "geographicCode" TEXT NOT NULL DEFAULT '',
    "period" TEXT NOT NULL DEFAULT '',
    "value" DOUBLE PRECISION,
    "unit" TEXT NOT NULL DEFAULT '',
    "fetchedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TechInegiIndicator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TechInegiSyncLog" (
    "id" TEXT NOT NULL,
    "user" TEXT,
    "success" BOOLEAN NOT NULL DEFAULT false,
    "message" TEXT NOT NULL DEFAULT '',
    "created" INTEGER DEFAULT 0,
    "updated" INTEGER DEFAULT 0,
    "alreadyInDb" INTEGER DEFAULT 0,
    "totalFetched" INTEGER DEFAULT 0,
    "sourceMethod" TEXT NOT NULL DEFAULT 'api',
    "searchParams" JSONB,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TechInegiSyncLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TechInegiEconomicActivity_scianCode_key" ON "TechInegiEconomicActivity"("scianCode");

-- CreateIndex
CREATE INDEX "TechInegiEconomicActivity_name_idx" ON "TechInegiEconomicActivity"("name");

-- CreateIndex
CREATE UNIQUE INDEX "TechInegiEstablishment_clee_key" ON "TechInegiEstablishment"("clee");

-- CreateIndex
CREATE INDEX "TechInegiEstablishment_name_idx" ON "TechInegiEstablishment"("name");

-- CreateIndex
CREATE INDEX "TechInegiEstablishment_economicActivity_idx" ON "TechInegiEstablishment"("economicActivity");

-- CreateIndex
CREATE INDEX "TechInegiEstablishment_municipality_idx" ON "TechInegiEstablishment"("municipality");

-- CreateIndex
CREATE INDEX "TechInegiEstablishment_state_idx" ON "TechInegiEstablishment"("state");

-- CreateIndex
CREATE UNIQUE INDEX "TechInegiGeoBoundary_cacheKey_key" ON "TechInegiGeoBoundary"("cacheKey");

-- CreateIndex
CREATE INDEX "TechInegiGeoBoundary_geoCode_idx" ON "TechInegiGeoBoundary"("geoCode");

-- CreateIndex
CREATE INDEX "TechInegiGeoBoundary_name_idx" ON "TechInegiGeoBoundary"("name");

-- CreateIndex
CREATE UNIQUE INDEX "TechInegiIndicator_cacheKey_key" ON "TechInegiIndicator"("cacheKey");

-- CreateIndex
CREATE INDEX "TechInegiIndicator_indicatorId_idx" ON "TechInegiIndicator"("indicatorId");

-- CreateIndex
CREATE INDEX "TechInegiIndicator_geographicCode_idx" ON "TechInegiIndicator"("geographicCode");

-- CreateIndex
CREATE INDEX "TechInegiSyncLog_user_idx" ON "TechInegiSyncLog"("user");

-- CreateIndex
CREATE INDEX "TechBusinessLead_sourceEstablishment_idx" ON "TechBusinessLead"("sourceEstablishment");

-- AddForeignKey
ALTER TABLE "TechBusinessLead" ADD CONSTRAINT "TechBusinessLead_sourceEstablishment_fkey" FOREIGN KEY ("sourceEstablishment") REFERENCES "TechInegiEstablishment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechInegiEstablishment" ADD CONSTRAINT "TechInegiEstablishment_economicActivity_fkey" FOREIGN KEY ("economicActivity") REFERENCES "TechInegiEconomicActivity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechInegiSyncLog" ADD CONSTRAINT "TechInegiSyncLog_user_fkey" FOREIGN KEY ("user") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
