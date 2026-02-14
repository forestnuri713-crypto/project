-- CreateEnum: PaymentSettlementStatus
CREATE TYPE "PaymentSettlementStatus" AS ENUM ('PENDING', 'CONFIRMED', 'PAID');

-- CreateEnum: PayoutStatus
CREATE TYPE "PayoutStatus" AS ENUM ('INITIATED', 'SUCCESS', 'FAILED');

-- CreateTable: PaymentSettlement
CREATE TABLE "payment_settlements" (
    "id" TEXT NOT NULL,
    "reservation_id" TEXT NOT NULL,
    "payment_id" TEXT NOT NULL,
    "gross_amount" INTEGER NOT NULL,
    "platform_rate" DECIMAL(5,4) NOT NULL DEFAULT 0.1000,
    "platform_fee" INTEGER NOT NULL,
    "net_amount" INTEGER NOT NULL,
    "status" "PaymentSettlementStatus" NOT NULL DEFAULT 'PENDING',
    "confirmed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_settlements_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Payout
CREATE TABLE "payouts" (
    "id" TEXT NOT NULL,
    "settlement_id" TEXT NOT NULL,
    "payout_key" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" "PayoutStatus" NOT NULL DEFAULT 'INITIATED',
    "executed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payouts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payment_settlements_reservation_id_key" ON "payment_settlements"("reservation_id");
CREATE UNIQUE INDEX "payment_settlements_payment_id_key" ON "payment_settlements"("payment_id");
CREATE UNIQUE INDEX "payouts_payout_key_key" ON "payouts"("payout_key");

-- AddForeignKey
ALTER TABLE "payment_settlements" ADD CONSTRAINT "payment_settlements_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_settlement_id_fkey" FOREIGN KEY ("settlement_id") REFERENCES "payment_settlements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
