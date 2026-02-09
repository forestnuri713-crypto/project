export enum SettlementStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  PAID = 'PAID',
}

export interface Settlement {
  id: string;
  instructorId: string;
  periodStart: Date;
  periodEnd: Date;
  grossAmount: number;
  refundAmount: number;
  platformFee: number;
  notificationCost: number;
  b2bCommission: number;
  netAmount: number;
  status: SettlementStatus;
  paidAt?: Date;
  memo?: string;
  createdAt: Date;
  updatedAt: Date;
}
