-- CreateTable
CREATE TABLE "TechFile" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "category" TEXT DEFAULT 'otro',
    "file_filesize" INTEGER,
    "file_filename" TEXT,
    "company" TEXT,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "TechFile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TechFile_title_idx" ON "TechFile"("title");

-- CreateIndex
CREATE INDEX "TechFile_category_idx" ON "TechFile"("category");

-- CreateIndex
CREATE INDEX "TechFile_company_idx" ON "TechFile"("company");

-- AddForeignKey
ALTER TABLE "TechFile" ADD CONSTRAINT "TechFile_company_fkey" FOREIGN KEY ("company") REFERENCES "SaasCompany"("id") ON DELETE SET NULL ON UPDATE CASCADE;
