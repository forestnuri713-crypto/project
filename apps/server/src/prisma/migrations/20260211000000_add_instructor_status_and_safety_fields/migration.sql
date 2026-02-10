-- CreateEnum
CREATE TYPE "InstructorStatus" AS ENUM ('NONE', 'APPLIED', 'APPROVED', 'REJECTED');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'INSTRUCTOR_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE 'INSTRUCTOR_REJECTED';

-- AlterTable: Add instructor status fields to users
ALTER TABLE "users" ADD COLUMN "instructor_status" "InstructorStatus" NOT NULL DEFAULT 'NONE';
ALTER TABLE "users" ADD COLUMN "instructor_status_reason" TEXT;
ALTER TABLE "users" ADD COLUMN "certifications" JSONB NOT NULL DEFAULT '[]';

-- AlterTable: Add safety fields to programs
ALTER TABLE "programs" ADD COLUMN "safety_guide" TEXT;
ALTER TABLE "programs" ADD COLUMN "insurance_covered" BOOLEAN NOT NULL DEFAULT false;

-- Migrate existing INSTRUCTOR users to APPROVED status
UPDATE "users" SET "instructor_status" = 'APPROVED' WHERE "role" = 'INSTRUCTOR';
