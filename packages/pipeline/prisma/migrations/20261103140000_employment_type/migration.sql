-- CreateEnum
CREATE TYPE "EmploymentType" AS ENUM ('PERMANENT', 'CONTRACT', 'UNKNOWN');

-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "employmentType" "EmploymentType" NOT NULL DEFAULT 'UNKNOWN';

