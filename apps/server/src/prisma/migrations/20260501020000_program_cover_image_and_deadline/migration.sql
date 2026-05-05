-- Add cover image key and booking deadline days
ALTER TABLE "programs" ADD COLUMN "cover_image_key" TEXT;
ALTER TABLE "programs" ADD COLUMN "booking_deadline_days" INTEGER;
