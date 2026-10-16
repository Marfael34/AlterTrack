-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "gmailUser" TEXT,
    "gmailAppPassword" TEXT,
    "template" TEXT DEFAULT 'Bonjour,

Actuellement à la recherche d''une opportunité en alternance, je me permets de vous contacter pour vous soumettre ma candidature au sein de votre entreprise.

Vous trouverez ci-joint mon CV détaillant mes compétences et réalisations.

Restant à votre entière disposition pour un échange téléphonique ou un entretien, je vous remercie par avance pour l''attention portée à ma démarche.

Bien cordialement,',
    "cvFilePath" TEXT,
    "cvOriginalName" TEXT,
    "expoPushToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- AlterTable
ALTER TABLE "Company" ADD COLUMN "userId" TEXT;

-- CreateIndex
CREATE INDEX "Company_userId_idx" ON "Company"("userId");

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Default User for existing records
INSERT INTO "User" ("id", "email", "password", "fullName", "updatedAt")
VALUES ('00000000-0000-0000-0000-000000000001', 'candidat@altertrack.local', '$2a$10$5o0q7.pYdYQvUvV4uXbveOGpD.Zf8oP1Bv3hK8p7xW5q1l2m3n4o5', 'Rafael Martinez', CURRENT_TIMESTAMP)
ON CONFLICT ("email") DO NOTHING;

UPDATE "Company" SET "userId" = '00000000-0000-0000-0000-000000000001' WHERE "userId" IS NULL;
