-- DropForeignKey
ALTER TABLE "AuditLog" DROP CONSTRAINT "AuditLog_projectId_fkey";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "RateEvent" (
    "id" TEXT NOT NULL,
    "bucket" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RateEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RateEvent_bucket_key_createdAt_idx" ON "RateEvent"("bucket", "key", "createdAt");

-- CreateIndex
CREATE INDEX "RateEvent_createdAt_idx" ON "RateEvent"("createdAt");

-- CreateIndex
CREATE INDEX "ChecklistItem_projectId_idx" ON "ChecklistItem"("projectId");

-- CreateIndex
CREATE INDEX "Document_projectId_checklistItemId_idx" ON "Document"("projectId", "checklistItemId");

-- CreateIndex
CREATE INDEX "JuryAssignment_juryId_idx" ON "JuryAssignment"("juryId");

-- CreateIndex
CREATE INDEX "MentorAssignment_mentorId_idx" ON "MentorAssignment"("mentorId");

-- CreateIndex
CREATE INDEX "MentorSession_projectId_scheduledAt_idx" ON "MentorSession"("projectId", "scheduledAt");

-- CreateIndex
CREATE INDEX "MentorSession_mentorId_scheduledAt_idx" ON "MentorSession"("mentorId", "scheduledAt");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ProjectMember_userId_idx" ON "ProjectMember"("userId");

-- CreateIndex
CREATE INDEX "Risk_projectId_status_idx" ON "Risk"("projectId", "status");

-- CreateIndex
CREATE INDEX "Task_projectId_status_dueDate_idx" ON "Task"("projectId", "status", "dueDate");

-- CreateIndex
CREATE INDEX "Task_assigneeId_status_idx" ON "Task"("assigneeId", "status");

-- CreateIndex
CREATE INDEX "Training_startsAt_idx" ON "Training"("startsAt");

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

