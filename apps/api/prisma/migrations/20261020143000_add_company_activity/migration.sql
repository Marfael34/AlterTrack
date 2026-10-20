-- CreateTable
CREATE TABLE "CompanyActivity" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'CUSTOM',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "metadata" TEXT,
    "performedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanyActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CompanyActivity_companyId_idx" ON "CompanyActivity"("companyId");

-- CreateIndex
CREATE INDEX "CompanyActivity_performedAt_idx" ON "CompanyActivity"("performedAt");

-- AddForeignKey
ALTER TABLE "CompanyActivity" ADD CONSTRAINT "CompanyActivity_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
