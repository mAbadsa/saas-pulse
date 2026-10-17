-- AlterTable
ALTER TABLE "AlertChannel" ALTER COLUMN "target" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "AlertChannel_userId_idx" ON "AlertChannel"("userId");

