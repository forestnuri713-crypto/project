export enum UserRole {
  PARENT = 'PARENT',
  INSTRUCTOR = 'INSTRUCTOR',
  ADMIN = 'ADMIN',
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  password?: string;
  kakaoId?: string;
  profileImageUrl?: string;
  phoneNumber: string;
  fcmToken?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthResponse {
  accessToken: string;
  user: Omit<User, 'password'>;
}
