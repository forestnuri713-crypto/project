-- CreateEnum
CREATE TYPE "BulkCancelJobStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'COMPLETED_WITH_ERRORS', 'FAILED');

-- CreateEnum
CREATE TYPE "BulkCancelItemResult" AS ENUM ('SUCCESS', 'FAILED', 'SKIPPED');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'RESERVATION_BULK_CANCELLED';

-- CreateTable
CREATE TABLE "bulk_cancel_jobs" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "reason" VARCHAR(200) NOT NULL,
    "mode" TEXT NOT NULL,
    "status" "BulkCancelJobStatus" NOT NULL DEFAULT 'PENDING',
    "total_targets" INTEGER NOT NULL DEFAULT 0,
    "success_count" INTEGER NOT NULL DEFAULT 0,
    "failed_count" INTEGER NOT NULL DEFAULT 0,
    "skipped_count" INTEGER NOT NULL DEFAULT 0,
    "created_by_admin_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),

    CONSTRAINT "bulk_cancel_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bulk_cancel_job_items" (
    "id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "reservation_id" TEXT NOT NULL,
    "result" "BulkCancelItemResult" NOT NULL DEFAULT 'FAILED',
    "failure_code" TEXT,
    "failure_message" TEXT,
    "attempted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "refunded_amount" INTEGER,
    "notification_sent" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "bulk_cancel_job_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "bulk_cancel_job_items_job_id_reservation_id_key" ON "bulk_cancel_job_items"("job_id", "reservation_id");

-- AddForeignKey
ALTER TABLE "bulk_cancel_jobs" ADD CONSTRAINT "bulk_cancel_jobs_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "programs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bulk_cancel_jobs" ADD CONSTRAINT "bulk_cancel_jobs_created_by_admin_user_id_fkey" FOREIGN KEY ("created_by_admin_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bulk_cancel_job_items" ADD CONSTRAINT "bulk_cancel_job_items_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "bulk_cancel_jobs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bulk_cancel_job_items" ADD CONSTRAINT "bulk_cancel_job_items_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
