-- CreateTable
CREATE TABLE "GoogleCalendarAccount" (
    "id" TEXT NOT NULL,
    "scopeType" TEXT NOT NULL DEFAULT 'personal',
    "user" TEXT,
    "company" TEXT,
    "connectedByUser" TEXT,
    "googleAccountEmail" TEXT NOT NULL DEFAULT '',
    "accessTokenEncrypted" TEXT,
    "refreshTokenEncrypted" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncedAt" TIMESTAMP(3),
    "lastSyncError" TEXT,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GoogleCalendarAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoogleCalendarSelection" (
    "id" TEXT NOT NULL,
    "account" TEXT,
    "googleCalendarId" TEXT NOT NULL DEFAULT '',
    "calendarName" TEXT NOT NULL DEFAULT '',
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "isSelected" BOOLEAN NOT NULL DEFAULT false,
    "colorHex" TEXT,
    "pushActivities" BOOLEAN NOT NULL DEFAULT true,
    "pushProposals" BOOLEAN NOT NULL DEFAULT true,
    "pushFollowUps" BOOLEAN NOT NULL DEFAULT true,
    "pushTasks" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "GoogleCalendarSelection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TechCalendarEvent" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "description" TEXT,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3),
    "allDay" BOOLEAN NOT NULL DEFAULT false,
    "location" TEXT,
    "sourceType" TEXT NOT NULL DEFAULT 'native',
    "salesActivity" TEXT,
    "followUpTask" TEXT,
    "task" TEXT,
    "proposal" TEXT,
    "createdBy" TEXT,
    "company" TEXT,
    "workspace" TEXT,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "TechCalendarEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TechCalendarEventGoogleLink" (
    "id" TEXT NOT NULL,
    "event" TEXT,
    "calendarSelection" TEXT,
    "googleEventId" TEXT,
    "lastPushedAt" TIMESTAMP(3),
    "lastPushStatus" TEXT DEFAULT 'pending',
    "lastPushError" TEXT,

    CONSTRAINT "TechCalendarEventGoogleLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TechGoogleCalendarSyncLog" (
    "id" TEXT NOT NULL,
    "account" TEXT,
    "direction" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL DEFAULT false,
    "errorMessage" TEXT,
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TechGoogleCalendarSyncLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_GoogleCalendarSelection_targetedEvents" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE INDEX "GoogleCalendarAccount_scopeType_idx" ON "GoogleCalendarAccount"("scopeType");

-- CreateIndex
CREATE INDEX "GoogleCalendarAccount_user_idx" ON "GoogleCalendarAccount"("user");

-- CreateIndex
CREATE INDEX "GoogleCalendarAccount_company_idx" ON "GoogleCalendarAccount"("company");

-- CreateIndex
CREATE INDEX "GoogleCalendarAccount_connectedByUser_idx" ON "GoogleCalendarAccount"("connectedByUser");

-- CreateIndex
CREATE INDEX "GoogleCalendarAccount_googleAccountEmail_idx" ON "GoogleCalendarAccount"("googleAccountEmail");

-- CreateIndex
CREATE INDEX "GoogleCalendarSelection_account_idx" ON "GoogleCalendarSelection"("account");

-- CreateIndex
CREATE INDEX "GoogleCalendarSelection_googleCalendarId_idx" ON "GoogleCalendarSelection"("googleCalendarId");

-- CreateIndex
CREATE UNIQUE INDEX "TechCalendarEvent_salesActivity_key" ON "TechCalendarEvent"("salesActivity");

-- CreateIndex
CREATE UNIQUE INDEX "TechCalendarEvent_followUpTask_key" ON "TechCalendarEvent"("followUpTask");

-- CreateIndex
CREATE UNIQUE INDEX "TechCalendarEvent_task_key" ON "TechCalendarEvent"("task");

-- CreateIndex
CREATE UNIQUE INDEX "TechCalendarEvent_proposal_key" ON "TechCalendarEvent"("proposal");

-- CreateIndex
CREATE INDEX "TechCalendarEvent_startAt_idx" ON "TechCalendarEvent"("startAt");

-- CreateIndex
CREATE INDEX "TechCalendarEvent_sourceType_idx" ON "TechCalendarEvent"("sourceType");

-- CreateIndex
CREATE INDEX "TechCalendarEvent_createdBy_idx" ON "TechCalendarEvent"("createdBy");

-- CreateIndex
CREATE INDEX "TechCalendarEvent_company_idx" ON "TechCalendarEvent"("company");

-- CreateIndex
CREATE INDEX "TechCalendarEvent_workspace_idx" ON "TechCalendarEvent"("workspace");

-- CreateIndex
CREATE INDEX "TechCalendarEventGoogleLink_event_idx" ON "TechCalendarEventGoogleLink"("event");

-- CreateIndex
CREATE INDEX "TechCalendarEventGoogleLink_calendarSelection_idx" ON "TechCalendarEventGoogleLink"("calendarSelection");

-- CreateIndex
CREATE INDEX "TechCalendarEventGoogleLink_googleEventId_idx" ON "TechCalendarEventGoogleLink"("googleEventId");

-- CreateIndex
CREATE INDEX "TechGoogleCalendarSyncLog_account_idx" ON "TechGoogleCalendarSyncLog"("account");

-- CreateIndex
CREATE INDEX "TechGoogleCalendarSyncLog_direction_idx" ON "TechGoogleCalendarSyncLog"("direction");

-- CreateIndex
CREATE INDEX "TechGoogleCalendarSyncLog_operation_idx" ON "TechGoogleCalendarSyncLog"("operation");

-- CreateIndex
CREATE UNIQUE INDEX "_GoogleCalendarSelection_targetedEvents_AB_unique" ON "_GoogleCalendarSelection_targetedEvents"("A", "B");

-- CreateIndex
CREATE INDEX "_GoogleCalendarSelection_targetedEvents_B_index" ON "_GoogleCalendarSelection_targetedEvents"("B");

-- AddForeignKey
ALTER TABLE "GoogleCalendarAccount" ADD CONSTRAINT "GoogleCalendarAccount_user_fkey" FOREIGN KEY ("user") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoogleCalendarAccount" ADD CONSTRAINT "GoogleCalendarAccount_company_fkey" FOREIGN KEY ("company") REFERENCES "SaasCompany"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoogleCalendarAccount" ADD CONSTRAINT "GoogleCalendarAccount_connectedByUser_fkey" FOREIGN KEY ("connectedByUser") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoogleCalendarSelection" ADD CONSTRAINT "GoogleCalendarSelection_account_fkey" FOREIGN KEY ("account") REFERENCES "GoogleCalendarAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechCalendarEvent" ADD CONSTRAINT "TechCalendarEvent_salesActivity_fkey" FOREIGN KEY ("salesActivity") REFERENCES "TechSalesActivity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechCalendarEvent" ADD CONSTRAINT "TechCalendarEvent_followUpTask_fkey" FOREIGN KEY ("followUpTask") REFERENCES "TechFollowUpTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechCalendarEvent" ADD CONSTRAINT "TechCalendarEvent_task_fkey" FOREIGN KEY ("task") REFERENCES "TechTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechCalendarEvent" ADD CONSTRAINT "TechCalendarEvent_proposal_fkey" FOREIGN KEY ("proposal") REFERENCES "TechProposal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechCalendarEvent" ADD CONSTRAINT "TechCalendarEvent_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechCalendarEvent" ADD CONSTRAINT "TechCalendarEvent_company_fkey" FOREIGN KEY ("company") REFERENCES "SaasCompany"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechCalendarEvent" ADD CONSTRAINT "TechCalendarEvent_workspace_fkey" FOREIGN KEY ("workspace") REFERENCES "SaasWorkspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechCalendarEventGoogleLink" ADD CONSTRAINT "TechCalendarEventGoogleLink_event_fkey" FOREIGN KEY ("event") REFERENCES "TechCalendarEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechCalendarEventGoogleLink" ADD CONSTRAINT "TechCalendarEventGoogleLink_calendarSelection_fkey" FOREIGN KEY ("calendarSelection") REFERENCES "GoogleCalendarSelection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechGoogleCalendarSyncLog" ADD CONSTRAINT "TechGoogleCalendarSyncLog_account_fkey" FOREIGN KEY ("account") REFERENCES "GoogleCalendarAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_GoogleCalendarSelection_targetedEvents" ADD CONSTRAINT "_GoogleCalendarSelection_targetedEvents_A_fkey" FOREIGN KEY ("A") REFERENCES "GoogleCalendarSelection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_GoogleCalendarSelection_targetedEvents" ADD CONSTRAINT "_GoogleCalendarSelection_targetedEvents_B_fkey" FOREIGN KEY ("B") REFERENCES "TechCalendarEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
