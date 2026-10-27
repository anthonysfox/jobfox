-- CreateTable
CREATE TABLE "ApplicationDraft" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "promptHash" TEXT NOT NULL,
    "questions" TEXT[],
    "bullets" JSONB NOT NULL,
    "answers" TEXT[],
    "costUsd" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApplicationDraft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ApplicationDraft_jobId_createdAt_idx" ON "ApplicationDraft"("jobId", "createdAt");

-- AddForeignKey
ALTER TABLE "ApplicationDraft" ADD CONSTRAINT "ApplicationDraft_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

