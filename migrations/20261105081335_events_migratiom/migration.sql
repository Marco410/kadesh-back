-- AlterTable
ALTER TABLE "User" ADD COLUMN     "alertCity" TEXT,
ADD COLUMN     "alertCityKey" TEXT,
ADD COLUMN     "alertStateCode" TEXT,
ADD COLUMN     "eventAlertsEnabled" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "PetEvent" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "slug" TEXT,
    "category" TEXT NOT NULL,
    "species" JSONB NOT NULL DEFAULT '[]',
    "description" TEXT NOT NULL DEFAULT '',
    "requirements" TEXT NOT NULL DEFAULT '',
    "organizerName" TEXT NOT NULL DEFAULT '',
    "contactPhone" TEXT NOT NULL DEFAULT '',
    "petPlace" TEXT,
    "user" TEXT,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "placeLabel" TEXT NOT NULL DEFAULT '',
    "address" TEXT NOT NULL DEFAULT '',
    "neighborhood" TEXT NOT NULL DEFAULT '',
    "city" TEXT NOT NULL DEFAULT '',
    "cityKey" TEXT,
    "state" TEXT NOT NULL DEFAULT '',
    "stateCode" TEXT,
    "timeZone" TEXT NOT NULL DEFAULT 'America/Mexico_City',
    "scope" TEXT NOT NULL DEFAULT 'zone',
    "reachKm" INTEGER DEFAULT 10,
    "isFree" BOOLEAN NOT NULL DEFAULT true,
    "price" INTEGER,
    "priceNote" TEXT NOT NULL DEFAULT '',
    "capacity" INTEGER,
    "registrationUrl" TEXT NOT NULL DEFAULT '',
    "registrationWhatsapp" TEXT NOT NULL DEFAULT '',
    "facebookUrl" TEXT NOT NULL DEFAULT '',
    "instagramUrl" TEXT NOT NULL DEFAULT '',
    "tiktokUrl" TEXT NOT NULL DEFAULT '',
    "xUrl" TEXT NOT NULL DEFAULT '',
    "websiteUrl" TEXT NOT NULL DEFAULT '',
    "firstStartsAt" TIMESTAMP(3),
    "lastEndsAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reviewNote" TEXT NOT NULL DEFAULT '',
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "pendingChangeNotice" BOOLEAN NOT NULL DEFAULT false,
    "zoneAlertsSentAt" TIMESTAMP(3),
    "zoneAlertsCount" INTEGER DEFAULT 0,
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "PetEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PetEventSession" (
    "id" TEXT NOT NULL,
    "event" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PetEventSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PetEventMultimedia" (
    "id" TEXT NOT NULL,
    "image_id" TEXT,
    "image_filesize" INTEGER,
    "image_width" INTEGER,
    "image_height" INTEGER,
    "image_extension" TEXT,
    "event" TEXT,
    "order" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PetEventMultimedia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PetEventInterest" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL DEFAULT '',
    "event" TEXT,
    "user" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'interested',
    "lastRemindedSessionId" TEXT,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PetEventInterest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PetEvent_slug_key" ON "PetEvent"("slug");

-- CreateIndex
CREATE INDEX "PetEvent_category_idx" ON "PetEvent"("category");

-- CreateIndex
CREATE INDEX "PetEvent_petPlace_idx" ON "PetEvent"("petPlace");

-- CreateIndex
CREATE INDEX "PetEvent_user_idx" ON "PetEvent"("user");

-- CreateIndex
CREATE INDEX "PetEvent_cityKey_idx" ON "PetEvent"("cityKey");

-- CreateIndex
CREATE INDEX "PetEvent_stateCode_idx" ON "PetEvent"("stateCode");

-- CreateIndex
CREATE INDEX "PetEvent_firstStartsAt_idx" ON "PetEvent"("firstStartsAt");

-- CreateIndex
CREATE INDEX "PetEvent_lastEndsAt_idx" ON "PetEvent"("lastEndsAt");

-- CreateIndex
CREATE INDEX "PetEvent_status_idx" ON "PetEvent"("status");

-- CreateIndex
CREATE INDEX "PetEvent_reviewedBy_idx" ON "PetEvent"("reviewedBy");

-- CreateIndex
CREATE INDEX "PetEventSession_event_idx" ON "PetEventSession"("event");

-- CreateIndex
CREATE INDEX "PetEventSession_startsAt_idx" ON "PetEventSession"("startsAt");

-- CreateIndex
CREATE INDEX "PetEventSession_endsAt_idx" ON "PetEventSession"("endsAt");

-- CreateIndex
CREATE INDEX "PetEventMultimedia_event_idx" ON "PetEventMultimedia"("event");

-- CreateIndex
CREATE UNIQUE INDEX "PetEventInterest_key_key" ON "PetEventInterest"("key");

-- CreateIndex
CREATE INDEX "PetEventInterest_event_idx" ON "PetEventInterest"("event");

-- CreateIndex
CREATE INDEX "PetEventInterest_user_idx" ON "PetEventInterest"("user");

-- CreateIndex
CREATE INDEX "PetEventInterest_kind_idx" ON "PetEventInterest"("kind");

-- CreateIndex
CREATE INDEX "User_alertCityKey_idx" ON "User"("alertCityKey");

-- CreateIndex
CREATE INDEX "User_alertStateCode_idx" ON "User"("alertStateCode");

-- AddForeignKey
ALTER TABLE "PetEvent" ADD CONSTRAINT "PetEvent_petPlace_fkey" FOREIGN KEY ("petPlace") REFERENCES "PetPlace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PetEvent" ADD CONSTRAINT "PetEvent_user_fkey" FOREIGN KEY ("user") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PetEvent" ADD CONSTRAINT "PetEvent_reviewedBy_fkey" FOREIGN KEY ("reviewedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PetEventSession" ADD CONSTRAINT "PetEventSession_event_fkey" FOREIGN KEY ("event") REFERENCES "PetEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PetEventMultimedia" ADD CONSTRAINT "PetEventMultimedia_event_fkey" FOREIGN KEY ("event") REFERENCES "PetEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PetEventInterest" ADD CONSTRAINT "PetEventInterest_event_fkey" FOREIGN KEY ("event") REFERENCES "PetEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PetEventInterest" ADD CONSTRAINT "PetEventInterest_user_fkey" FOREIGN KEY ("user") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
