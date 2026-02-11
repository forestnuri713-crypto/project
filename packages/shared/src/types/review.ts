export enum ReviewStatus {
  VISIBLE = 'VISIBLE',
  HIDDEN = 'HIDDEN',
}

export interface Review {
  id: string;
  programId: string;
  reservationId: string;
  parentUserId: string;
  rating: number;
  comment: string;
  status: ReviewStatus;
  editedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
