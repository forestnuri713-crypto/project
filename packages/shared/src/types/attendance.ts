export enum AttendanceStatus {
  ATTENDED = 'ATTENDED',
  NO_SHOW = 'NO_SHOW',
}

export interface Attendance {
  id: string;
  reservationId: string;
  status: AttendanceStatus;
  qrCode: string;
  checkedAt?: Date;
  checkedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}
