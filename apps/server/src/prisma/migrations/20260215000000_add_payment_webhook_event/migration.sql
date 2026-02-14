-- AlterEnum: add CANCELLED to PaymentStatus
ALTER TYPE "PaymentStatus" ADD VALUE 'CANCELLED';

-- CreateEnum: WebhookProvider
CREATE TYPE "WebhookProvider" AS ENUM ('PORTONE');

-- CreateEnum: WebhookEventStatus
CREATE TYPE "WebhookEventStatus" AS ENUM ('RECEIVED', 'PROCESSED', 'IGNORED', 'FAILED');

-- AlterTable: add merchantUid, cancelledAt, failedAt to payments
ALTER TABLE "payments" ADD COLUMN "merchant_uid" TEXT;
ALTER TABLE "payments" ADD COLUMN "cancelled_at" TIMESTAMP(3);
ALTER TABLE "payments" ADD COLUMN "failed_at" TIMESTAMP(3);

-- Backfill: set merchant_uid = portone_payment_id for existing rows
UPDATE "payments" SET "merchant_uid" = "portone_payment_id" WHERE "merchant_uid" IS NULL;

-- Now make merchant_uid NOT NULL + UNIQUE
ALTER TABLE "payments" ALTER COLUMN "merchant_uid" SET NOT NULL;
CREATE UNIQUE INDEX "payments_merchant_uid_key" ON "payments"("merchant_uid");

-- CreateTable: PaymentWebhookEvent
CREATE TABLE "payment_webhook_events" (
    "id" TEXT NOT NULL,
    "provider" "WebhookProvider" NOT NULL,
    "event_key" TEXT NOT NULL,
    "merchant_uid" TEXT,
    "event_type" TEXT NOT NULL,
    "status" "WebhookEventStatus" NOT NULL DEFAULT 'RECEIVED',
    "raw_body" JSONB,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payment_webhook_events_provider_event_key_key" ON "payment_webhook_events"("provider", "event_key");
CREATE INDEX "payment_webhook_events_merchant_uid_idx" ON "payment_webhook_events"("merchant_uid");
CREATE INDEX "payment_webhook_events_received_at_idx" ON "payment_webhook_events"("received_at");
