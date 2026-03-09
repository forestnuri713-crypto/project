/* ── 공통 페이지네이션 ── */

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  /** 일부 엔드포인트는 limit, 일부는 pageSize 사용 */
  limit?: number;
  pageSize?: number;
  totalPages?: number;
}

/* ── 에러 ── */

export interface ErrorState {
  message: string;
  code: string | null;
  requestId: string | null;
}

/* ── 상태 enum ── */

export type InstructorStatus = 'NONE' | 'APPLIED' | 'APPROVED' | 'REJECTED';

export type ApprovalStatus = 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED';

export type ReviewStatus = 'VISIBLE' | 'HIDDEN';

export type SettlementStatus = 'PENDING' | 'CONFIRMED' | 'PAID';

export type BulkCancelJobStatus =
  | 'PENDING'
  | 'RUNNING'
  | 'COMPLETED'
  | 'COMPLETED_WITH_ERRORS'
  | 'FAILED';

export type BulkCancelItemResult = 'SUCCESS' | 'FAILED' | 'SKIPPED';

/* ── 엔티티 ── */

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: string;
  phoneNumber?: string;
  createdAt: string;
}

export interface AdminInstructor {
  id: string;
  email: string;
  name: string;
  role: string;
  phoneNumber?: string;
  profileImageUrl?: string;
  instructorStatus: InstructorStatus;
  instructorStatusReason?: string;
  certifications: Certification[];
  createdAt: string;
}

export interface Certification {
  type: string;
  label: string;
  iconType?: string;
}

export interface AdminProgram {
  id: string;
  title: string;
  approvalStatus: ApprovalStatus;
  createdAt: string;
  instructor?: { id: string; name: string; email: string };
}

export interface AdminReview {
  id: string;
  rating: number;
  comment: string;
  status: ReviewStatus;
  editedAt?: string;
  createdAt: string;
  program?: { id: string; title: string };
  parentUser?: { id: string; name: string };
}

export interface AdminSettlement {
  id: string;
  providerId?: string;
  instructorId?: string;
  totalAmount: number;
  status: SettlementStatus;
  periodStart: string;
  periodEnd: string;
  createdAt: string;
}

export interface AdminProvider {
  id: string;
  name: string;
  regionTags: string[];
  createdAt: string;
  profile?: { isPublished: boolean };
}

export interface ProviderProfileData {
  provider: { id: string; name: string; regionTags: string[] };
  profile: {
    displayName: string;
    introShort?: string;
    certificationsText?: string;
    storyText?: string;
    coverImageUrls: string[];
    contactLinks: string[];
    isPublished: boolean;
  } | null;
}

/* ── 대시보드 ── */

export interface DashboardStats {
  totalUsers: number;
  totalReservations: number;
  totalRevenue: number;
  pendingPrograms: number;
  pendingInstructors: number;
}

/* ── 일괄 취소 ── */

export interface EstimatedRefund {
  reservationId: string;
  userId: string;
  totalPrice: number;
  estimatedRefund: number;
}

export interface DryRunResult {
  dryRun: true;
  mode: string;
  sessionId: string;
  totalTargets: number;
  estimatedRefunds: EstimatedRefund[];
}

export interface CreatedJob {
  id: string;
  sessionId: string;
  reason: string;
  mode: string;
  status: BulkCancelJobStatus;
  totalTargets: number;
}

export interface JobSummary {
  id: string;
  sessionId: string;
  reason: string;
  mode: string;
  status: BulkCancelJobStatus;
  totalTargets: number;
  successCount: number;
  failedCount: number;
  skippedCount: number;
  startedAt?: string;
  finishedAt?: string;
  program?: { id: string; title: string };
}

export interface JobItem {
  id: string;
  reservationId: string;
  result: BulkCancelItemResult;
  failureCode?: string;
  failureMessage?: string;
  attemptedAt?: string;
  refundedAmount?: number;
  notificationSent?: boolean;
  reservation?: { id: string; userId: string; participantCount: number };
}

export interface JobItemsResponse {
  items: JobItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
