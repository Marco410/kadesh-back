-- CreateTable
CREATE TABLE "Donation" (
    "id" TEXT NOT NULL,
    "unitCount" INTEGER NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'mxn',
    "donorName" TEXT NOT NULL DEFAULT '',
    "donorEmail" TEXT NOT NULL DEFAULT '',
    "donorKey" TEXT NOT NULL DEFAULT '',
    "user" TEXT,
    "message" TEXT NOT NULL DEFAULT '',
    "isAnonymous" BOOLEAN NOT NULL DEFAULT false,
    "hideFromWall" BOOLEAN NOT NULL DEFAULT false,
    "messageHidden" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "checkoutKey" TEXT,
    "stripePaymentIntentId" TEXT,
    "stripeChargeId" TEXT,
    "source" TEXT DEFAULT 'other',
    "sourceRef" TEXT NOT NULL DEFAULT '',
    "errorMessage" TEXT NOT NULL DEFAULT '',
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Donation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Donation_checkoutKey_key" ON "Donation"("checkoutKey");

-- CreateIndex
CREATE UNIQUE INDEX "Donation_stripePaymentIntentId_key" ON "Donation"("stripePaymentIntentId");

-- CreateIndex
CREATE INDEX "Donation_donorKey_idx" ON "Donation"("donorKey");

-- CreateIndex
CREATE INDEX "Donation_user_idx" ON "Donation"("user");

-- CreateIndex
CREATE INDEX "Donation_status_idx" ON "Donation"("status");

-- CreateIndex
CREATE INDEX "Donation_paidAt_idx" ON "Donation"("paidAt");

-- CreateIndex
CREATE INDEX "Donation_status_paidAt_idx" ON "Donation"("status", "paidAt");

-- AddForeignKey
ALTER TABLE "Donation" ADD CONSTRAINT "Donation_user_fkey" FOREIGN KEY ("user") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
