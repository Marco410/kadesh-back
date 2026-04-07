-- CreateTable
CREATE TABLE "SaasSubscriptionLog" (
    "id" TEXT NOT NULL,
    "user" TEXT,
    "company" TEXT,
    "plan" TEXT,
    "createdSubscription" TEXT,
    "success" BOOLEAN NOT NULL DEFAULT false,
    "step" TEXT NOT NULL DEFAULT '',
    "message" TEXT NOT NULL DEFAULT '',
    "responseSnapshot" JSONB,
    "emailMasked" TEXT NOT NULL DEFAULT '',
    "planIdRequested" TEXT NOT NULL DEFAULT '',
    "totalSubmitted" TEXT NOT NULL DEFAULT '',
    "paymentMethodIdSubmitted" TEXT NOT NULL DEFAULT '',
    "paymentTypeSubmitted" TEXT NOT NULL DEFAULT '',
    "durationMs" INTEGER,
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SaasSubscriptionLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SaasSubscriptionLog_user_idx" ON "SaasSubscriptionLog"("user");

-- CreateIndex
CREATE INDEX "SaasSubscriptionLog_company_idx" ON "SaasSubscriptionLog"("company");

-- CreateIndex
CREATE INDEX "SaasSubscriptionLog_plan_idx" ON "SaasSubscriptionLog"("plan");

-- CreateIndex
CREATE INDEX "SaasSubscriptionLog_createdSubscription_idx" ON "SaasSubscriptionLog"("createdSubscription");

-- CreateIndex
CREATE INDEX "SaasSubscriptionLog_step_idx" ON "SaasSubscriptionLog"("step");

-- AddForeignKey
ALTER TABLE "SaasSubscriptionLog" ADD CONSTRAINT "SaasSubscriptionLog_user_fkey" FOREIGN KEY ("user") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaasSubscriptionLog" ADD CONSTRAINT "SaasSubscriptionLog_company_fkey" FOREIGN KEY ("company") REFERENCES "SaasCompany"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaasSubscriptionLog" ADD CONSTRAINT "SaasSubscriptionLog_plan_fkey" FOREIGN KEY ("plan") REFERENCES "SaasPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaasSubscriptionLog" ADD CONSTRAINT "SaasSubscriptionLog_createdSubscription_fkey" FOREIGN KEY ("createdSubscription") REFERENCES "SaasCompanySubscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;
