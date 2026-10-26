-- pgvector ships with the pgvector/pgvector image; this enables it in the database.
CREATE EXTENSION IF NOT EXISTS vector;

-- CreateEnum
CREATE TYPE "Verdict" AS ENUM ('STRONG', 'POSSIBLE', 'WEAK');

-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "embedding" vector(384);

-- CreateTable
CREATE TABLE "JobScore" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "resumeHash" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "similarity" DOUBLE PRECISION NOT NULL,
    "fitScore" INTEGER NOT NULL,
    "verdict" "Verdict" NOT NULL,
    "summary" TEXT NOT NULL,
    "strengths" TEXT[],
    "gaps" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobLabel" (
    "jobId" TEXT NOT NULL,
    "label" "Verdict" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobLabel_pkey" PRIMARY KEY ("jobId")
);

-- CreateIndex
CREATE UNIQUE INDEX "JobScore_jobId_resumeHash_model_key" ON "JobScore"("jobId", "resumeHash", "model");

-- AddForeignKey
ALTER TABLE "JobScore" ADD CONSTRAINT "JobScore_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobLabel" ADD CONSTRAINT "JobLabel_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;
