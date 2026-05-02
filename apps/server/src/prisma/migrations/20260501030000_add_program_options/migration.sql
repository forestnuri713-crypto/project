-- CreateTable
CREATE TABLE "program_options" (
    "id" TEXT NOT NULL,
    "program_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price_diff" INTEGER NOT NULL DEFAULT 0,
    "capacity" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "program_options_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "program_options_program_id_idx" ON "program_options"("program_id");

-- AddForeignKey
ALTER TABLE "program_options" ADD CONSTRAINT "program_options_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
