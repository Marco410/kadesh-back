-- CreateTable
CREATE TABLE "SystemRelease" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL DEFAULT '',
    "product" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "body" TEXT NOT NULL DEFAULT '',
    "releasedAt" TIMESTAMP(3) NOT NULL,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SystemRelease_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SystemRelease_version_idx" ON "SystemRelease"("version");
