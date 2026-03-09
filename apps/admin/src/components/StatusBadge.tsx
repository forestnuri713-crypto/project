'use client';

const VARIANT_MAP: Record<string, Record<string, { className: string; label: string }>> = {
  instructor: {
    APPLIED: { className: 'bg-yellow-100 text-yellow-800', label: '대기' },
    APPROVED: { className: 'bg-green-100 text-green-800', label: '승인' },
    REJECTED: { className: 'bg-red-100 text-red-800', label: '거절' },
  },
  approval: {
    PENDING_REVIEW: { className: 'bg-yellow-100 text-yellow-800', label: '대기' },
    APPROVED: { className: 'bg-green-100 text-green-800', label: '승인' },
    REJECTED: { className: 'bg-red-100 text-red-800', label: '거절' },
  },
  review: {
    VISIBLE: { className: 'bg-green-100 text-green-800', label: '공개' },
    HIDDEN: { className: 'bg-red-100 text-red-800', label: '숨김' },
  },
  settlement: {
    PENDING: { className: 'bg-yellow-100 text-yellow-800', label: '대기' },
    CONFIRMED: { className: 'bg-blue-100 text-blue-800', label: '확인' },
    PAID: { className: 'bg-green-100 text-green-800', label: '지급 완료' },
  },
  role: {
    PARENT: { className: 'bg-gray-100 text-gray-800', label: '학부모' },
    INSTRUCTOR: { className: 'bg-blue-100 text-blue-800', label: '강사' },
    ADMIN: { className: 'bg-purple-100 text-purple-800', label: '관리자' },
  },
  bulkCancelJob: {
    PENDING: { className: 'bg-yellow-100 text-yellow-800', label: '대기' },
    RUNNING: { className: 'bg-blue-100 text-blue-800', label: '실행 중' },
    COMPLETED: { className: 'bg-green-100 text-green-800', label: '완료' },
    COMPLETED_WITH_ERRORS: { className: 'bg-orange-100 text-orange-800', label: '부분 완료' },
    FAILED: { className: 'bg-red-100 text-red-800', label: '실패' },
  },
  bulkCancelItem: {
    SUCCESS: { className: 'bg-green-100 text-green-800', label: '성공' },
    FAILED: { className: 'bg-red-100 text-red-800', label: '실패' },
    SKIPPED: { className: 'bg-gray-100 text-gray-800', label: '건너뜀' },
  },
};

interface StatusBadgeProps {
  status: string;
  variant: keyof typeof VARIANT_MAP;
}

export default function StatusBadge({ status, variant }: StatusBadgeProps) {
  const config = VARIANT_MAP[variant]?.[status];
  const className = config?.className ?? 'bg-gray-100 text-gray-800';
  const label = config?.label ?? status;

  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${className}`}>
      {label}
    </span>
  );
}
