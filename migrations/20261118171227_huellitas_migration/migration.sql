-- AlterTable
ALTER TABLE "Animal" ADD COLUMN     "rewardAmount" INTEGER,
ADD COLUMN     "rewardOffered" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "PawAccount" (
    "id" TEXT NOT NULL,
    "user" TEXT,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "lifetimeEarned" INTEGER NOT NULL DEFAULT 0,
    "streakWeeks" INTEGER NOT NULL DEFAULT 0,
    "bestStreakWeeks" INTEGER NOT NULL DEFAULT 0,
    "streakWeekStart" TEXT NOT NULL DEFAULT '',
    "rankingHidden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "PawAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PawTransaction" (
    "id" TEXT NOT NULL,
    "user" TEXT,
    "action" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'earn',
    "amount" INTEGER NOT NULL,
    "balanceAfter" INTEGER,
    "key" TEXT NOT NULL DEFAULT '',
    "sourceKey" TEXT NOT NULL DEFAULT '',
    "referenceType" TEXT NOT NULL DEFAULT '',
    "referenceId" TEXT NOT NULL DEFAULT '',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PawTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PawAccount_user_idx" ON "PawAccount"("user");

-- CreateIndex
CREATE INDEX "PawAccount_lifetimeEarned_idx" ON "PawAccount"("lifetimeEarned");

-- CreateIndex
CREATE UNIQUE INDEX "PawAccount_user_key" ON "PawAccount"("user");

-- CreateIndex
CREATE UNIQUE INDEX "PawTransaction_key_key" ON "PawTransaction"("key");

-- CreateIndex
CREATE INDEX "PawTransaction_user_idx" ON "PawTransaction"("user");

-- CreateIndex
CREATE INDEX "PawTransaction_sourceKey_idx" ON "PawTransaction"("sourceKey");

-- CreateIndex
CREATE INDEX "PawTransaction_createdAt_idx" ON "PawTransaction"("createdAt");

-- CreateIndex
CREATE INDEX "PawTransaction_user_createdAt_idx" ON "PawTransaction"("user", "createdAt");

-- AddForeignKey
ALTER TABLE "PawAccount" ADD CONSTRAINT "PawAccount_user_fkey" FOREIGN KEY ("user") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PawTransaction" ADD CONSTRAINT "PawTransaction_user_fkey" FOREIGN KEY ("user") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
