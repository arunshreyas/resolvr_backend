-- CreateEnum
CREATE TYPE "DisputeAlertStatus" AS ENUM ('OPEN', 'REVIEWED', 'DISMISSED');

-- CreateTable
CREATE TABLE "DisputeAlerts" (
    "id" SERIAL NOT NULL,
    "complaintId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "userEmail" TEXT NOT NULL,
    "userMessage" TEXT NOT NULL,
    "assistantResponse" TEXT NOT NULL,
    "urgentReason" TEXT,
    "status" "DisputeAlertStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DisputeAlerts_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "DisputeAlerts" ADD CONSTRAINT "DisputeAlerts_complaintId_fkey" FOREIGN KEY ("complaintId") REFERENCES "Complaints"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisputeAlerts" ADD CONSTRAINT "DisputeAlerts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
