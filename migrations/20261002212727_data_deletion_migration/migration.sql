-- CreateTable
CREATE TABLE "MetaDataDeletionRequest" (
    "id" TEXT NOT NULL,
    "metaUserId" TEXT NOT NULL DEFAULT '',
    "confirmationCode" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "MetaDataDeletionRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MetaDataDeletionRequest_confirmationCode_key" ON "MetaDataDeletionRequest"("confirmationCode");

-- CreateIndex
CREATE INDEX "MetaDataDeletionRequest_metaUserId_idx" ON "MetaDataDeletionRequest"("metaUserId");

-- CreateIndex
CREATE INDEX "MetaDataDeletionRequest_status_idx" ON "MetaDataDeletionRequest"("status");
