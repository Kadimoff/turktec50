-- CreateEnum
CREATE TYPE "IntakeStatus" AS ENUM ('SUBMITTED', 'UNDER_REVIEW', 'NEEDS_CHANGES', 'ACCEPTED', 'REJECTED', 'WITHDRAWN');

-- CreateTable
CREATE TABLE "IntakeRequest" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "status" "IntakeStatus" NOT NULL DEFAULT 'SUBMITTED',
    "teamName" TEXT NOT NULL,
    "universityId" TEXT NOT NULL,
    "facultyId" TEXT,
    "competitionId" TEXT NOT NULL,
    "subcategory" TEXT,
    "projectIdea" TEXT NOT NULL,
    "needs" TEXT[],
    "needsNote" TEXT,
    "consentAt" TIMESTAMP(3) NOT NULL,
    "reviewerId" TEXT,
    "reviewNote" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "teamId" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntakeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntakeMember" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "facultyId" TEXT,
    "role" TEXT,
    "isCaptain" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "IntakeMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntakeEvent" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "from" "IntakeStatus",
    "to" "IntakeStatus" NOT NULL,
    "note" TEXT,
    "actorId" TEXT,
    "source" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntakeEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IntakeRequest_code_key" ON "IntakeRequest"("code");

-- CreateIndex
CREATE UNIQUE INDEX "IntakeRequest_tokenHash_key" ON "IntakeRequest"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "IntakeRequest_teamId_key" ON "IntakeRequest"("teamId");

-- CreateIndex
CREATE INDEX "IntakeRequest_status_submittedAt_idx" ON "IntakeRequest"("status", "submittedAt");

-- CreateIndex
CREATE INDEX "IntakeMember_email_idx" ON "IntakeMember"("email");

-- CreateIndex
CREATE INDEX "IntakeEvent_requestId_at_idx" ON "IntakeEvent"("requestId", "at");

-- AddForeignKey
ALTER TABLE "IntakeRequest" ADD CONSTRAINT "IntakeRequest_universityId_fkey" FOREIGN KEY ("universityId") REFERENCES "University"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntakeRequest" ADD CONSTRAINT "IntakeRequest_facultyId_fkey" FOREIGN KEY ("facultyId") REFERENCES "Faculty"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntakeRequest" ADD CONSTRAINT "IntakeRequest_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntakeRequest" ADD CONSTRAINT "IntakeRequest_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntakeRequest" ADD CONSTRAINT "IntakeRequest_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntakeMember" ADD CONSTRAINT "IntakeMember_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "IntakeRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntakeMember" ADD CONSTRAINT "IntakeMember_facultyId_fkey" FOREIGN KEY ("facultyId") REFERENCES "Faculty"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntakeEvent" ADD CONSTRAINT "IntakeEvent_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "IntakeRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntakeEvent" ADD CONSTRAINT "IntakeEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

