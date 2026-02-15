-- AlterTable: Add slug column to users (nullable)
ALTER TABLE "users" ADD COLUMN "slug" TEXT;

-- CreateIndex: Unique index on slug
CREATE UNIQUE INDEX "users_slug_key" ON "users"("slug");
