-- CreateTable
CREATE TABLE "SaasCredit" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL DEFAULT '',
    "name" TEXT NOT NULL DEFAULT '',
    "cost" DOUBLE PRECISION,
    "costOld" DOUBLE PRECISION,
    "frequency" TEXT DEFAULT 'once',
    "currency" TEXT NOT NULL DEFAULT 'mxn',
    "creditsToAdd" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "bestSeller" BOOLEAN NOT NULL DEFAULT false,
    "stripePriceId" TEXT,
    "stripeProductId" TEXT,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "SaasCredit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SaasCredit_slug_key" ON "SaasCredit"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "SaasCredit_stripePriceId_key" ON "SaasCredit"("stripePriceId");
