-- Add payment/cancel/inquiry guide columns
ALTER TABLE "programs" ADD COLUMN "payment_guide" TEXT;
ALTER TABLE "programs" ADD COLUMN "cancel_guide" TEXT;
ALTER TABLE "programs" ADD COLUMN "inquiry_guide" TEXT;
