-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('VISIBLE', 'HIDDEN');

-- CreateTable
CREATE TABLE "reviews" (
    "id" TEXT NOT NULL,
    "program_id" TEXT NOT NULL,
    "reservation_id" TEXT NOT NULL,
    "parent_user_id" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" VARCHAR(300) NOT NULL,
    "status" "ReviewStatus" NOT NULL DEFAULT 'VISIBLE',
    "edited_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "reviews_reservation_id_key" ON "reviews"("reservation_id");

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_parent_user_id_fkey" FOREIGN KEY ("parent_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
