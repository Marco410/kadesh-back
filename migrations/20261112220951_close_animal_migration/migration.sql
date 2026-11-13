-- AlterTable
ALTER TABLE "Animal" ADD COLUMN     "closedAt" TIMESTAMP(3),
ADD COLUMN     "helpedByKadesh" TEXT,
ADD COLUMN     "outcome" TEXT,
ADD COLUMN     "outcomeChannel" TEXT,
ADD COLUMN     "outcomeStory" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "storyConsent" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Animal_outcome_idx" ON "Animal"("outcome");

-- CreateIndex
CREATE INDEX "Animal_closedAt_idx" ON "Animal"("closedAt");
