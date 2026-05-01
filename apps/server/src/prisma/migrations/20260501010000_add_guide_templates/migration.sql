-- CreateEnum
CREATE TYPE "GuideKind" AS ENUM ('SAFETY', 'PAYMENT', 'CANCEL', 'INQUIRY');

-- CreateTable
CREATE TABLE "guide_templates" (
    "id" TEXT NOT NULL,
    "kind" "GuideKind" NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guide_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "guide_templates_kind_key" ON "guide_templates"("kind");
