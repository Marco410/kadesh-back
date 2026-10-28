-- AlterTable
ALTER TABLE "Animal" ADD COLUMN     "duplicateCheck" JSONB,
ADD COLUMN     "duplicateOf" TEXT;

-- AlterTable
ALTER TABLE "AnimalComment" ADD COLUMN     "kind" TEXT NOT NULL DEFAULT 'comment';

-- CreateTable
CREATE TABLE "AnimalClaim" (
    "id" TEXT NOT NULL,
    "animal" TEXT,
    "claimant" TEXT,
    "claimantName" TEXT NOT NULL DEFAULT '',
    "previousUser" TEXT,
    "message" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "evidence_id" TEXT,
    "evidence_filesize" INTEGER,
    "evidence_width" INTEGER,
    "evidence_height" INTEGER,
    "evidence_extension" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "rejectReason" TEXT NOT NULL DEFAULT '',
    "resolvedBy" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnimalClaim_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AnimalClaim_animal_idx" ON "AnimalClaim"("animal");

-- CreateIndex
CREATE INDEX "AnimalClaim_claimant_idx" ON "AnimalClaim"("claimant");

-- CreateIndex
CREATE INDEX "AnimalClaim_previousUser_idx" ON "AnimalClaim"("previousUser");

-- CreateIndex
CREATE INDEX "AnimalClaim_resolvedBy_idx" ON "AnimalClaim"("resolvedBy");

-- CreateIndex
CREATE INDEX "Animal_duplicateOf_idx" ON "Animal"("duplicateOf");

-- AddForeignKey
ALTER TABLE "Animal" ADD CONSTRAINT "Animal_duplicateOf_fkey" FOREIGN KEY ("duplicateOf") REFERENCES "Animal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnimalClaim" ADD CONSTRAINT "AnimalClaim_animal_fkey" FOREIGN KEY ("animal") REFERENCES "Animal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnimalClaim" ADD CONSTRAINT "AnimalClaim_claimant_fkey" FOREIGN KEY ("claimant") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnimalClaim" ADD CONSTRAINT "AnimalClaim_previousUser_fkey" FOREIGN KEY ("previousUser") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnimalClaim" ADD CONSTRAINT "AnimalClaim_resolvedBy_fkey" FOREIGN KEY ("resolvedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
