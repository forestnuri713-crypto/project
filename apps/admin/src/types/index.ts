export type ProgramStatus = 'draft' | 'published' | 'closed' | 'archived';
export type ReservationStatus = 'pending' | 'approved' | 'rejected' | 'cancelled' | 'completed';
export type UserRole = 'user' | 'operator' | 'super_admin';

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  is_active: boolean;
  nationality?: string;
  language?: string;
  phone?: string;
  profile_image_url?: string;
  created_at: string;
}

export interface Program {
  id: string;
  title: string;
  subtitle?: string;
  description?: string;
  thumbnail_url?: string;
  location?: string;
  address?: string;
  start_date?: string;
  end_date?: string;
  capacity: number;
  current_reservation_count: number;
  status: ProgramStatus;
  is_featured: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

export interface Reservation {
  id: string;
  user_id: string;
  program_id: string;
  participant_count: number;
  reservation_status: ReservationStatus;
  memo?: string;
  approved_by?: string;
  approved_at?: string;
  cancelled_at?: string;
  completed_at?: string;
  created_at: string;
  user?: Pick<AdminUser, 'id' | 'name' | 'email'>;
  program?: Pick<Program, 'id' | 'title'>;
}

export interface Notice {
  id: string;
  title: string;
  content: string;
  is_published: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
}
