-- CreateEnum
CREATE TYPE "Role" AS ENUM ('CUSTOMER', 'OFFICER', 'ADMIN');

-- CreateEnum
CREATE TYPE "ClaimStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'MORE_INFO_REQUIRED', 'REVIEWED');

-- CreateEnum
CREATE TYPE "ScanStatus" AS ENUM ('PENDING', 'CLEAN', 'INFECTED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "AiRoute" AS ENUM ('ON_DEVICE', 'IN_CLOUD');

-- CreateEnum
CREATE TYPE "AiTask" AS ENUM ('NARRATIVE_REWRITE', 'MISSING_FIELDS', 'CASE_SUMMARY', 'IMAGE_CHECK');

-- CreateEnum
CREATE TYPE "AiStatus" AS ENUM ('SUCCESS', 'FAILED', 'REJECTED_OUTPUT');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "identitySubject" TEXT NOT NULL,
    "email" TEXT,
    "role" "Role" NOT NULL DEFAULT 'CUSTOMER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "disabledAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClaimCase" (
    "id" TEXT NOT NULL,
    "publicReference" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "policyReferenceMasked" TEXT,
    "incidentAt" TIMESTAMP(3),
    "incidentLocation" TEXT,
    "incidentType" TEXT,
    "narrative" TEXT,
    "vehicleDescription" TEXT,
    "injuriesReported" BOOLEAN,
    "otherPartiesInvolved" BOOLEAN,
    "contactChannel" TEXT,
    "status" "ClaimStatus" NOT NULL DEFAULT 'DRAFT',
    "aiDraft" JSONB,
    "officerSummary" TEXT,
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClaimCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evidence" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "storageObjectKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "scanStatus" "ScanStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploadedAt" TIMESTAMP(3),

    CONSTRAINT "Evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiAnalysis" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "taskType" "AiTask" NOT NULL,
    "route" "AiRoute" NOT NULL,
    "fallbackReason" TEXT,
    "modelId" TEXT,
    "promptVersion" TEXT NOT NULL,
    "outputSchemaVersion" TEXT NOT NULL,
    "status" "AiStatus" NOT NULL,
    "latencyMs" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsentRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "consentVersion" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "withdrawnAt" TIMESTAMP(3),

    CONSTRAINT "ConsentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClaimEvent" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "fromStatus" "ClaimStatus",
    "toStatus" "ClaimStatus",
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClaimEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_identitySubject_key" ON "User"("identitySubject");

-- CreateIndex
CREATE UNIQUE INDEX "ClaimCase_publicReference_key" ON "ClaimCase"("publicReference");

-- CreateIndex
CREATE INDEX "ClaimCase_customerId_idx" ON "ClaimCase"("customerId");

-- CreateIndex
CREATE INDEX "ClaimCase_status_submittedAt_idx" ON "ClaimCase"("status", "submittedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Evidence_storageObjectKey_key" ON "Evidence"("storageObjectKey");

-- CreateIndex
CREATE INDEX "Evidence_claimId_idx" ON "Evidence"("claimId");

-- CreateIndex
CREATE INDEX "AiAnalysis_claimId_idx" ON "AiAnalysis"("claimId");

-- CreateIndex
CREATE INDEX "ConsentRecord_claimId_purpose_idx" ON "ConsentRecord"("claimId", "purpose");

-- CreateIndex
CREATE INDEX "ClaimEvent_claimId_createdAt_idx" ON "ClaimEvent"("claimId", "createdAt");

-- AddForeignKey
ALTER TABLE "ClaimCase" ADD CONSTRAINT "ClaimCase_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "ClaimCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiAnalysis" ADD CONSTRAINT "AiAnalysis_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "ClaimCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentRecord" ADD CONSTRAINT "ConsentRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentRecord" ADD CONSTRAINT "ConsentRecord_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "ClaimCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClaimEvent" ADD CONSTRAINT "ClaimEvent_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "ClaimCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClaimEvent" ADD CONSTRAINT "ClaimEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
