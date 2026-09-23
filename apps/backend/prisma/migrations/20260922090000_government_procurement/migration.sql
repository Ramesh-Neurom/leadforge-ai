-- CreateEnum
CREATE TYPE "TenderIntegration" AS ENUM ('GEM_BIDPLUS', 'MANUAL_GOVT_TENDER');

-- CreateEnum
CREATE TYPE "TenderStatus" AS ENUM ('NEW', 'RELEVANCE_REVIEW', 'ANALYZED', 'QUALIFICATION_PENDING', 'QUALIFIED', 'NOT_QUALIFIED', 'NOT_PURSUING', 'BID_PREPARATION', 'INTERNAL_REVIEW', 'READY_FOR_SUBMISSION', 'SUBMITTED', 'AWARDED', 'LOST', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ComplianceStatus" AS ENUM ('COMPLIANT', 'PARTIALLY_COMPLIANT', 'NOT_COMPLIANT', 'NEEDS_VERIFICATION', 'NOT_APPLICABLE');

-- CreateEnum
CREATE TYPE "BidStatus" AS ENUM ('IN_PREPARATION', 'TECHNICAL_REVIEW', 'DOCUMENT_REVIEW', 'COMMERCIAL_REVIEW', 'READY_FOR_SUBMISSION', 'SUBMITTED_MANUALLY', 'NOT_PURSUED', 'WON', 'LOST');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED');

-- CreateEnum
CREATE TYPE "MatchClassification" AS ENUM ('STRONG_MATCH', 'POSSIBLE_MATCH', 'WEAK_MATCH', 'NOT_RELEVANT');

-- CreateTable
CREATE TABLE "TenderSource" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "integrationType" "TenderIntegration" NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "configJson" JSONB NOT NULL,
    "lastSyncAt" TIMESTAMP(3),
    "lastSyncStatus" TEXT,
    "lastSyncMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenderSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tender" (
    "id" TEXT NOT NULL,
    "tenderSourceId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "bidNumber" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "buyerName" TEXT,
    "ministry" TEXT,
    "department" TEXT,
    "state" TEXT,
    "locationText" TEXT,
    "serviceCategory" TEXT,
    "tenderType" TEXT,
    "estimatedValue" DECIMAL(18,2),
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "publishedAt" TIMESTAMP(3),
    "closesAt" TIMESTAMP(3),
    "emdAmount" DECIMAL(18,2),
    "emdRequired" BOOLEAN,
    "msePreference" BOOLEAN,
    "startupPreference" BOOLEAN,
    "contractDuration" TEXT,
    "scopeOfWork" TEXT,
    "requirements" JSONB,
    "relevance" TEXT NOT NULL DEFAULT 'POSSIBLY_RELEVANT',
    "relevanceReason" TEXT,
    "status" "TenderStatus" NOT NULL DEFAULT 'NEW',
    "sourceUrl" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tender_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenderRevision" (
    "id" TEXT NOT NULL,
    "tenderId" TEXT NOT NULL,
    "fieldName" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TenderRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenderDocument" (
    "id" TEXT NOT NULL,
    "tenderId" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "extractedText" TEXT,
    "processingStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "processingError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenderDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenderAnalysis" (
    "id" TEXT NOT NULL,
    "tenderId" TEXT NOT NULL,
    "executiveSummary" TEXT NOT NULL,
    "serviceClassification" TEXT NOT NULL,
    "overallMatchScore" INTEGER NOT NULL,
    "matchClassification" "MatchClassification" NOT NULL,
    "rawStructuredResult" JSONB NOT NULL,
    "inputHash" TEXT NOT NULL,
    "modelMetadata" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenderAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenderEligibility" (
    "id" TEXT NOT NULL,
    "tenderId" TEXT NOT NULL,
    "requirementType" TEXT NOT NULL,
    "requirement" TEXT NOT NULL,
    "requiredValue" TEXT,
    "companyValue" TEXT,
    "status" "ComplianceStatus" NOT NULL DEFAULT 'NEEDS_VERIFICATION',
    "evidence" TEXT,
    "notes" TEXT,
    "sourceDocumentId" TEXT,
    "sourcePage" INTEGER,
    "confirmedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenderEligibility_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenderComplianceItem" (
    "id" TEXT NOT NULL,
    "tenderId" TEXT NOT NULL,
    "requirement" TEXT NOT NULL,
    "clauseReference" TEXT,
    "documentReference" TEXT,
    "pageReference" INTEGER,
    "complianceStatus" "ComplianceStatus" NOT NULL DEFAULT 'NEEDS_VERIFICATION',
    "evidence" TEXT,
    "companyDocumentId" TEXT,
    "notes" TEXT,
    "confirmedById" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenderComplianceItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyProfile" (
    "id" TEXT NOT NULL DEFAULT 'company',
    "legalName" TEXT,
    "displayName" TEXT,
    "website" TEXT,
    "yearsInBusiness" INTEGER,
    "employeeCount" INTEGER,
    "turnover" TEXT,
    "locations" TEXT,
    "industries" TEXT,
    "certifications" TEXT,
    "msmeStatus" TEXT,
    "startupStatus" TEXT,
    "governmentExperience" TEXT,
    "experience" TEXT,
    "team" TEXT,
    "notes" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyCapability" (
    "id" TEXT NOT NULL,
    "companyProfileId" TEXT NOT NULL DEFAULT 'company',
    "category" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "proficiency" TEXT,
    "keywords" TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "CompanyCapability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyDocument" (
    "id" TEXT NOT NULL,
    "companyProfileId" TEXT NOT NULL DEFAULT 'company',
    "documentType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "issuer" TEXT,
    "issueDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "storageKey" TEXT,
    "mimeType" TEXT,
    "size" INTEGER,
    "sha256" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NEEDS_VERIFICATION',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BidWorkspace" (
    "id" TEXT NOT NULL,
    "tenderId" TEXT NOT NULL,
    "status" "BidStatus" NOT NULL DEFAULT 'IN_PREPARATION',
    "technicalApprovalStatus" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "documentApprovalStatus" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "commercialApprovalStatus" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "submittedById" TEXT,
    "portalReference" TEXT,
    "submissionNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BidWorkspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BidSection" (
    "id" TEXT NOT NULL,
    "bidWorkspaceId" TEXT NOT NULL,
    "sectionType" TEXT NOT NULL,
    "generatedContent" TEXT NOT NULL,
    "editedContent" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BidSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommercialWorksheet" (
    "id" TEXT NOT NULL,
    "bidWorkspaceId" TEXT NOT NULL,
    "effortEstimate" TEXT,
    "developmentCost" DECIMAL(18,2),
    "implementationCost" DECIMAL(18,2),
    "cloudCost" DECIMAL(18,2),
    "travelCost" DECIMAL(18,2),
    "supportCost" DECIMAL(18,2),
    "amcCost" DECIMAL(18,2),
    "taxAssumptions" TEXT,
    "internalMargin" DECIMAL(5,2),
    "recommendedInternalRange" TEXT,
    "approvedQuote" DECIMAL(18,2),
    "notes" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommercialWorksheet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GovernmentActivity" (
    "id" TEXT NOT NULL,
    "tenderId" TEXT,
    "actorUserId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GovernmentActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GovernmentNotification" (
    "id" TEXT NOT NULL,
    "tenderId" TEXT,
    "key" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GovernmentNotification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Tender_status_closesAt_idx" ON "Tender"("status", "closesAt");

-- CreateIndex
CREATE INDEX "Tender_state_serviceCategory_idx" ON "Tender"("state", "serviceCategory");

-- CreateIndex
CREATE UNIQUE INDEX "Tender_tenderSourceId_externalId_key" ON "Tender"("tenderSourceId", "externalId");

-- CreateIndex
CREATE INDEX "TenderRevision_tenderId_createdAt_idx" ON "TenderRevision"("tenderId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TenderDocument_tenderId_sha256_key" ON "TenderDocument"("tenderId", "sha256");

-- CreateIndex
CREATE UNIQUE INDEX "TenderAnalysis_tenderId_key" ON "TenderAnalysis"("tenderId");

-- CreateIndex
CREATE INDEX "TenderAnalysis_matchClassification_overallMatchScore_idx" ON "TenderAnalysis"("matchClassification", "overallMatchScore");

-- CreateIndex
CREATE UNIQUE INDEX "TenderEligibility_tenderId_requirement_key" ON "TenderEligibility"("tenderId", "requirement");

-- CreateIndex
CREATE UNIQUE INDEX "TenderComplianceItem_tenderId_requirement_key" ON "TenderComplianceItem"("tenderId", "requirement");

-- CreateIndex
CREATE INDEX "CompanyDocument_expiryDate_status_idx" ON "CompanyDocument"("expiryDate", "status");

-- CreateIndex
CREATE UNIQUE INDEX "BidWorkspace_tenderId_key" ON "BidWorkspace"("tenderId");

-- CreateIndex
CREATE INDEX "BidWorkspace_status_idx" ON "BidWorkspace"("status");

-- CreateIndex
CREATE UNIQUE INDEX "BidSection_bidWorkspaceId_sectionType_key" ON "BidSection"("bidWorkspaceId", "sectionType");

-- CreateIndex
CREATE UNIQUE INDEX "CommercialWorksheet_bidWorkspaceId_key" ON "CommercialWorksheet"("bidWorkspaceId");

-- CreateIndex
CREATE INDEX "GovernmentActivity_tenderId_createdAt_idx" ON "GovernmentActivity"("tenderId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "GovernmentNotification_key_key" ON "GovernmentNotification"("key");

-- CreateIndex
CREATE INDEX "GovernmentNotification_readAt_createdAt_idx" ON "GovernmentNotification"("readAt", "createdAt");

-- AddForeignKey
ALTER TABLE "Tender" ADD CONSTRAINT "Tender_tenderSourceId_fkey" FOREIGN KEY ("tenderSourceId") REFERENCES "TenderSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenderRevision" ADD CONSTRAINT "TenderRevision_tenderId_fkey" FOREIGN KEY ("tenderId") REFERENCES "Tender"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenderDocument" ADD CONSTRAINT "TenderDocument_tenderId_fkey" FOREIGN KEY ("tenderId") REFERENCES "Tender"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenderAnalysis" ADD CONSTRAINT "TenderAnalysis_tenderId_fkey" FOREIGN KEY ("tenderId") REFERENCES "Tender"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenderEligibility" ADD CONSTRAINT "TenderEligibility_tenderId_fkey" FOREIGN KEY ("tenderId") REFERENCES "Tender"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenderComplianceItem" ADD CONSTRAINT "TenderComplianceItem_tenderId_fkey" FOREIGN KEY ("tenderId") REFERENCES "Tender"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenderComplianceItem" ADD CONSTRAINT "TenderComplianceItem_companyDocumentId_fkey" FOREIGN KEY ("companyDocumentId") REFERENCES "CompanyDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyCapability" ADD CONSTRAINT "CompanyCapability_companyProfileId_fkey" FOREIGN KEY ("companyProfileId") REFERENCES "CompanyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyDocument" ADD CONSTRAINT "CompanyDocument_companyProfileId_fkey" FOREIGN KEY ("companyProfileId") REFERENCES "CompanyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BidWorkspace" ADD CONSTRAINT "BidWorkspace_tenderId_fkey" FOREIGN KEY ("tenderId") REFERENCES "Tender"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BidSection" ADD CONSTRAINT "BidSection_bidWorkspaceId_fkey" FOREIGN KEY ("bidWorkspaceId") REFERENCES "BidWorkspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommercialWorksheet" ADD CONSTRAINT "CommercialWorksheet_bidWorkspaceId_fkey" FOREIGN KEY ("bidWorkspaceId") REFERENCES "BidWorkspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GovernmentActivity" ADD CONSTRAINT "GovernmentActivity_tenderId_fkey" FOREIGN KEY ("tenderId") REFERENCES "Tender"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GovernmentNotification" ADD CONSTRAINT "GovernmentNotification_tenderId_fkey" FOREIGN KEY ("tenderId") REFERENCES "Tender"("id") ON DELETE CASCADE ON UPDATE CASCADE;
