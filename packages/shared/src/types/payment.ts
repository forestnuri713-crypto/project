export enum PaymentMethod {
  KAKAO_PAY = 'KAKAO_PAY',
  TOSS_PAY = 'TOSS_PAY',
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
  PARTIAL_REFUND = 'PARTIAL_REFUND',
}

export interface Payment {
  id: string;
  reservationId: string;
  method: PaymentMethod;
  portonePaymentId: string;
  amount: number;
  status: PaymentStatus;
  paidAt?: Date;
  refundedAmount: number;
  refundedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
