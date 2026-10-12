-- AlterTable
ALTER TABLE "UserAuthLog" ADD COLUMN     "ip" TEXT,
ADD COLUMN     "userAgent" TEXT;

-- CreateTable
CREATE TABLE "ActivityEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT '',
    "category" TEXT NOT NULL,
    "actor" TEXT,
    "company" TEXT,
    "workspace" TEXT,
    "entityType" TEXT,
    "entityId" TEXT,
    "summary" TEXT NOT NULL DEFAULT '',
    "metadata" JSONB,
    "source" TEXT,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "errorMessage" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserActivityDay" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL DEFAULT '',
    "user" TEXT,
    "company" TEXT,
    "day" DATE NOT NULL,
    "minutes" INTEGER DEFAULT 0,
    "firstSeenAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3),

    CONSTRAINT "UserActivityDay_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ActivityEvent_type_idx" ON "ActivityEvent"("type");

-- CreateIndex
CREATE INDEX "ActivityEvent_category_idx" ON "ActivityEvent"("category");

-- CreateIndex
CREATE INDEX "ActivityEvent_actor_idx" ON "ActivityEvent"("actor");

-- CreateIndex
CREATE INDEX "ActivityEvent_company_idx" ON "ActivityEvent"("company");

-- CreateIndex
CREATE INDEX "ActivityEvent_workspace_idx" ON "ActivityEvent"("workspace");

-- CreateIndex
CREATE INDEX "ActivityEvent_entityType_idx" ON "ActivityEvent"("entityType");

-- CreateIndex
CREATE INDEX "ActivityEvent_entityId_idx" ON "ActivityEvent"("entityId");

-- CreateIndex
CREATE INDEX "ActivityEvent_source_idx" ON "ActivityEvent"("source");

-- CreateIndex
CREATE INDEX "ActivityEvent_createdAt_idx" ON "ActivityEvent"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserActivityDay_key_key" ON "UserActivityDay"("key");

-- CreateIndex
CREATE INDEX "UserActivityDay_user_idx" ON "UserActivityDay"("user");

-- CreateIndex
CREATE INDEX "UserActivityDay_company_idx" ON "UserActivityDay"("company");

-- CreateIndex
CREATE INDEX "UserActivityDay_day_idx" ON "UserActivityDay"("day");

-- CreateIndex
CREATE INDEX "UserActivityDay_lastSeenAt_idx" ON "UserActivityDay"("lastSeenAt");

-- AddForeignKey
ALTER TABLE "ActivityEvent" ADD CONSTRAINT "ActivityEvent_actor_fkey" FOREIGN KEY ("actor") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityEvent" ADD CONSTRAINT "ActivityEvent_company_fkey" FOREIGN KEY ("company") REFERENCES "SaasCompany"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityEvent" ADD CONSTRAINT "ActivityEvent_workspace_fkey" FOREIGN KEY ("workspace") REFERENCES "SaasWorkspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserActivityDay" ADD CONSTRAINT "UserActivityDay_user_fkey" FOREIGN KEY ("user") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserActivityDay" ADD CONSTRAINT "UserActivityDay_company_fkey" FOREIGN KEY ("company") REFERENCES "SaasCompany"("id") ON DELETE SET NULL ON UPDATE CASCADE;
