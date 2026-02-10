export enum ApprovalStatus {
  PENDING_REVIEW = 'PENDING_REVIEW',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export interface Program {
  id: string;
  instructorId: string;
  title: string;
  description: string;
  location: string;
  latitude: number;
  longitude: number;
  price: number;
  maxCapacity: number;
  minAge: number;
  scheduleAt: Date;
  approvalStatus: ApprovalStatus;
  rejectionReason?: string;
  isB2b: boolean;
  providerId?: string;
  createdAt: Date;
  updatedAt: Date;
}
