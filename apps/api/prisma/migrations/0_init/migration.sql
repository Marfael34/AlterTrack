-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Status" AS ENUM ('TO_SEND', 'WAITING_FOR_REPLY', 'TO_FOLLOW_UP', 'TO_CALL', 'REPLY_RECEIVED', 'REFUSED', 'ACCEPTED');

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "notes" TEXT,
    "status" "Status" NOT NULL DEFAULT 'TO_SEND',
    "firstMailSentAt" TIMESTAMP(3),
    "followUpReadyAt" TIMESTAMP(3),
    "followUpSentAt" TIMESTAMP(3),
    "lastMailId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppConfig" (
    "id" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "cvFilePath" TEXT,
    "cvOriginalName" TEXT,
    "expoPushToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Company_status_idx" ON "Company"("status");

-- CreateIndex
CREATE INDEX "Company_email_idx" ON "Company"("email");

