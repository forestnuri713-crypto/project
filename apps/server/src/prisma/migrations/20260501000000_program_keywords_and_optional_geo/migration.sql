-- Make latitude/longitude optional on programs
ALTER TABLE "programs" ALTER COLUMN "latitude" DROP NOT NULL;
ALTER TABLE "programs" ALTER COLUMN "longitude" DROP NOT NULL;

-- Add keywords array (default empty)
ALTER TABLE "programs" ADD COLUMN "keywords" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
