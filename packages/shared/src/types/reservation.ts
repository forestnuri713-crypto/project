export enum ReservationStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  CANCELLED = 'CANCELLED',
  COMPLETED = 'COMPLETED',
}

export interface Reservation {
  id: string;
  userId: string;
  programId: string;
  status: ReservationStatus;
  participantCount: number;
  totalPrice: number;
  createdAt: Date;
  updatedAt: Date;
}
