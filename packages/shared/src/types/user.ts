export enum UserRole {
  PARENT = 'PARENT',
  INSTRUCTOR = 'INSTRUCTOR',
  ADMIN = 'ADMIN',
}

export enum InstructorStatus {
  NONE = 'NONE',
  APPLIED = 'APPLIED',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export interface InstructorCertification {
  type: string;
  label: string;
  iconType: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  kakaoId?: string;
  profileImageUrl?: string;
  phoneNumber: string;
  fcmToken?: string;
  messageCashBalance: number;
  instructorStatus: InstructorStatus;
  instructorStatusReason?: string;
  certifications: InstructorCertification[];
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthResponse {
  accessToken: string;
  user: User;
}
