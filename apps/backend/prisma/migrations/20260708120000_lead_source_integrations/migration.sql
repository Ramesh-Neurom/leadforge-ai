ALTER TABLE "LeadSource" ADD COLUMN "lastSyncAt" TIMESTAMP(3);
ALTER TABLE "LeadSource" ADD COLUMN "lastSyncStatus" TEXT;
ALTER TABLE "LeadSource" ADD COLUMN "lastSyncMessage" TEXT;
