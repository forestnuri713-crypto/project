-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "SettlementStatus" AS ENUM ('PENDING', 'CONFIRMED', 'PAID');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'PROGRAM_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE 'PROGRAM_REJECTED';
ALTER TYPE "NotificationType" ADD VALUE 'SETTLEMENT_CREATED';

-- AlterTable: Add approval and B2B fields to programs
ALTER TABLE "programs" ADD COLUMN "approval_status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING_REVIEW';
ALTER TABLE "programs" ADD COLUMN "rejection_reason" TEXT;
ALTER TABLE "programs" ADD COLUMN "is_b2b" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable: settlements
CREATE TABLE "settlements" (
    "id" TEXT NOT NULL,
    "instructor_id" TEXT NOT NULL,
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "gross_amount" INTEGER NOT NULL,
    "refund_amount" INTEGER NOT NULL,
    "platform_fee" INTEGER NOT NULL,
    "notification_cost" INTEGER NOT NULL,
    "b2b_commission" INTEGER NOT NULL,
    "net_amount" INTEGER NOT NULL,
    "status" "SettlementStatus" NOT NULL DEFAULT 'PENDING',
    "paid_at" TIMESTAMP(3),
    "memo" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settlements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "programs_approval_status_idx" ON "programs"("approval_status");

-- CreateIndex
CREATE UNIQUE INDEX "settlements_instructor_id_period_start_period_end_key" ON "settlements"("instructor_id", "period_start", "period_end");

-- AddForeignKey
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_instructor_id_fkey" FOREIGN KEY ("instructor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Migrate existing programs to APPROVED status
UPDATE "programs" SET "approval_status" = 'APPROVED' WHERE "approval_status" = 'PENDING_REVIEW';
