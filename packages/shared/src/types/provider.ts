export enum ProviderRole {
  OWNER = 'OWNER',
  MANAGER = 'MANAGER',
  INSTRUCTOR = 'INSTRUCTOR',
}

export enum ProviderMemberStatus {
  ACTIVE = 'ACTIVE',
  INVITED = 'INVITED',
  SUSPENDED = 'SUSPENDED',
}

export interface Provider {
  id: string;
  name: string;
  businessType?: string;
  regionTags?: string[];
  phone?: string;
  email?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProviderMember {
  id: string;
  providerId: string;
  userId: string;
  roleInProvider: ProviderRole;
  status: ProviderMemberStatus;
  createdAt: Date;
}

export interface ProviderProfile {
  id: string;
  providerId: string;
  displayName: string;
  introShort?: string;
  certificationsText?: string;
  storyText?: string;
  coverImageUrls: string[];
  contactLinks: string[];
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}
