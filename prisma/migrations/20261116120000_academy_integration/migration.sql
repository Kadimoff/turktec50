-- CreateEnum
CREATE TYPE "RuleStatus" AS ENUM ('TRACKING', 'CHANGED', 'CONFIRMED');

-- CreateEnum
CREATE TYPE "RegistryStatus" AS ENUM ('PLANNED', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "LabStatus" AS ENUM ('AVAILABLE', 'LIMITED', 'CLOSED');

-- CreateEnum
CREATE TYPE "PartnerStatus" AS ENUM ('CANDIDATE', 'NEGOTIATING', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "StudentStatus" AS ENUM ('CANDIDATE', 'SEEKING_TEAM', 'IN_TEAM', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "TeamStatus" AS ENUM ('FORMING', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "TrainingStatus" AS ENUM ('PLANNED', 'REGISTRATION_OPEN', 'COMPLETED');

-- CreateEnum
CREATE TYPE "ResourceStatus" AS ENUM ('NEW', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'DONE');

-- CreateEnum
CREATE TYPE "AnnouncementStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- AlterTable
ALTER TABLE "Application" ADD COLUMN     "teamId" TEXT;

-- AlterTable
ALTER TABLE "Competition" ADD COLUMN     "catalogId" INTEGER,
ADD COLUMN     "ruleCheckedAt" TIMESTAMP(3),
ADD COLUMN     "ruleNotes" TEXT,
ADD COLUMN     "ruleOwnerId" TEXT,
ADD COLUMN     "ruleSourceUrl" TEXT,
ADD COLUMN     "ruleStatus" "RuleStatus",
ADD COLUMN     "subcategories" TEXT[],
ADD COLUMN     "theme" TEXT,
ALTER COLUMN "category" DROP NOT NULL,
ALTER COLUMN "applicationDeadline" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "facultyId" TEXT,
ADD COLUMN     "labId" TEXT,
ADD COLUMN     "partnerId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "facultyId" TEXT;

-- CreateTable
CREATE TABLE "Faculty" (
    "id" TEXT NOT NULL,
    "universityId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "coordinator" TEXT,
    "status" "RegistryStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Faculty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lab" (
    "id" TEXT NOT NULL,
    "universityId" TEXT NOT NULL,
    "facultyId" TEXT,
    "name" TEXT NOT NULL,
    "contact" TEXT,
    "status" "LabStatus" NOT NULL DEFAULT 'AVAILABLE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lab_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Partner" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sector" TEXT,
    "contact" TEXT,
    "status" "PartnerStatus" NOT NULL DEFAULT 'CANDIDATE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Partner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Student" (
    "id" TEXT NOT NULL,
    "universityId" TEXT NOT NULL,
    "facultyId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "status" "StudentStatus" NOT NULL DEFAULT 'SEEKING_TEAM',
    "skills" TEXT,
    "notes" TEXT,
    "teamId" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Student_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "universityId" TEXT NOT NULL,
    "facultyId" TEXT,
    "name" TEXT NOT NULL,
    "status" "TeamStatus" NOT NULL DEFAULT 'FORMING',
    "mentorId" TEXT,
    "competitionId" TEXT,
    "captainId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Training" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "durationMin" INTEGER NOT NULL DEFAULT 90,
    "status" "TrainingStatus" NOT NULL DEFAULT 'PLANNED',
    "mentorId" TEXT,
    "labId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Training_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResourceRequest" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "details" TEXT,
    "labId" TEXT,
    "partnerId" TEXT,
    "neededBy" TIMESTAMP(3),
    "status" "ResourceStatus" NOT NULL DEFAULT 'NEW',
    "requestedById" TEXT,
    "decidedById" TEXT,
    "decisionNote" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResourceRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Announcement" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "AnnouncementStatus" NOT NULL DEFAULT 'DRAFT',
    "audience" "Role"[],
    "authorId" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Faculty_universityId_name_key" ON "Faculty"("universityId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Student_email_key" ON "Student"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Student_userId_key" ON "Student"("userId");

-- CreateIndex
CREATE INDEX "Student_teamId_idx" ON "Student"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "Team_captainId_key" ON "Team"("captainId");

-- CreateIndex
CREATE INDEX "ResourceRequest_projectId_status_idx" ON "ResourceRequest"("projectId", "status");

-- CreateIndex
CREATE INDEX "Announcement_status_publishedAt_idx" ON "Announcement"("status", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Competition_catalogId_key" ON "Competition"("catalogId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_facultyId_fkey" FOREIGN KEY ("facultyId") REFERENCES "Faculty"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Competition" ADD CONSTRAINT "Competition_ruleOwnerId_fkey" FOREIGN KEY ("ruleOwnerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_facultyId_fkey" FOREIGN KEY ("facultyId") REFERENCES "Faculty"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_labId_fkey" FOREIGN KEY ("labId") REFERENCES "Lab"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Faculty" ADD CONSTRAINT "Faculty_universityId_fkey" FOREIGN KEY ("universityId") REFERENCES "University"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lab" ADD CONSTRAINT "Lab_universityId_fkey" FOREIGN KEY ("universityId") REFERENCES "University"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lab" ADD CONSTRAINT "Lab_facultyId_fkey" FOREIGN KEY ("facultyId") REFERENCES "Faculty"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_universityId_fkey" FOREIGN KEY ("universityId") REFERENCES "University"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_facultyId_fkey" FOREIGN KEY ("facultyId") REFERENCES "Faculty"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_universityId_fkey" FOREIGN KEY ("universityId") REFERENCES "University"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_facultyId_fkey" FOREIGN KEY ("facultyId") REFERENCES "Faculty"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_captainId_fkey" FOREIGN KEY ("captainId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Training" ADD CONSTRAINT "Training_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Training" ADD CONSTRAINT "Training_labId_fkey" FOREIGN KEY ("labId") REFERENCES "Lab"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceRequest" ADD CONSTRAINT "ResourceRequest_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceRequest" ADD CONSTRAINT "ResourceRequest_labId_fkey" FOREIGN KEY ("labId") REFERENCES "Lab"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceRequest" ADD CONSTRAINT "ResourceRequest_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceRequest" ADD CONSTRAINT "ResourceRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceRequest" ADD CONSTRAINT "ResourceRequest_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

