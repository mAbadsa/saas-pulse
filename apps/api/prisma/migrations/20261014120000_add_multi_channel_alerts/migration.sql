-- AlterEnum
ALTER TYPE "AlertChannelType" ADD VALUE 'SLACK';
ALTER TYPE "AlertChannelType" ADD VALUE 'DISCORD';
ALTER TYPE "AlertChannelType" ADD VALUE 'EMAIL';

-- AlterTable: AlertChannel
ALTER TABLE "AlertChannel" ADD COLUMN "webhookUrl" TEXT,
ADD COLUMN "email" TEXT,
ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

-- Migrate existing 'enabled' values to 'isActive' for backward compatibility
UPDATE "AlertChannel" SET "isActive" = "enabled" WHERE "enabled" IS NOT NULL;

-- Drop the old 'enabled' column
ALTER TABLE "AlertChannel" DROP COLUMN "enabled";

-- CreateTable: AlertLog (for audit trail)
CREATE TABLE "AlertLog" (
    "id" TEXT NOT NULL,
    "monitorId" TEXT NOT NULL,
    "alertChannelId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "channelType" "AlertChannelType" NOT NULL,
    "deliveryStatus" TEXT NOT NULL,
    "errorMessage" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "AlertLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AlertLog_monitorId_timestamp_idx" ON "AlertLog"("monitorId", "timestamp");
CREATE INDEX "AlertLog_alertChannelId_timestamp_idx" ON "AlertLog"("alertChannelId", "timestamp");
CREATE INDEX "AlertLog_deliveryStatus_idx" ON "AlertLog"("deliveryStatus");

-- AddForeignKey
ALTER TABLE "AlertLog" ADD CONSTRAINT "AlertLog_monitorId_fkey" FOREIGN KEY ("monitorId") REFERENCES "Monitor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AlertLog" ADD CONSTRAINT "AlertLog_alertChannelId_fkey" FOREIGN KEY ("alertChannelId") REFERENCES "AlertChannel"("id") ON DELETE SET NULL ON UPDATE CASCADE;
