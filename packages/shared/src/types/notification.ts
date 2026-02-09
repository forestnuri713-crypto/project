export enum NotificationType {
  PRE_ACTIVITY = 'PRE_ACTIVITY',
  GALLERY_UPLOADED = 'GALLERY_UPLOADED',
  PROGRAM_APPROVED = 'PROGRAM_APPROVED',
  PROGRAM_REJECTED = 'PROGRAM_REJECTED',
  SETTLEMENT_CREATED = 'SETTLEMENT_CREATED',
}

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  isRead: boolean;
  data?: Record<string, unknown>;
  createdAt: Date;
}
