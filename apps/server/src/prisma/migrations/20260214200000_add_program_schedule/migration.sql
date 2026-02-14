-- CreateEnum: ProgramScheduleStatus
CREATE TYPE "ProgramScheduleStatus" AS ENUM ('ACTIVE', 'CANCELLED');

-- CreateTable: ProgramSchedule
CREATE TABLE "program_schedules" (
    "id" TEXT NOT NULL,
    "program_id" TEXT NOT NULL,
    "start_at" TIMESTAMP(3) NOT NULL,
    "end_at" TIMESTAMP(3),
    "capacity" INTEGER NOT NULL,
    "status" "ProgramScheduleStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "program_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "program_schedules_program_id_start_at_key" ON "program_schedules"("program_id", "start_at");
CREATE INDEX "program_schedules_start_at_idx" ON "program_schedules"("start_at");
CREATE INDEX "program_schedules_program_id_idx" ON "program_schedules"("program_id");

-- AddForeignKey
ALTER TABLE "program_schedules" ADD CONSTRAINT "program_schedules_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable: Reservation — add programScheduleId (nullable for migration)
ALTER TABLE "reservations" ADD COLUMN "program_schedule_id" TEXT;

-- CreateIndex
CREATE INDEX "reservations_program_schedule_id_idx" ON "reservations"("program_schedule_id");

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_program_schedule_id_fkey" FOREIGN KEY ("program_schedule_id") REFERENCES "program_schedules"("id") ON DELETE SET NULL ON UPDATE CASCADE;
