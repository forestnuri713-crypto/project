import type { ProgramStatus, ReservationStatus } from '@/types';

export const PROGRAM_STATUS_LABELS: Record<ProgramStatus, string> = {
  draft: '작성 중',
  published: '공개',
  closed: '마감',
  archived: '종료',
};

export const PROGRAM_STATUS_COLORS: Record<ProgramStatus, string> = {
  draft: 'bg-gray-100 text-gray-700',
  published: 'bg-green-100 text-green-700',
  closed: 'bg-yellow-100 text-yellow-700',
  archived: 'bg-red-100 text-red-700',
};

export const RESERVATION_STATUS_LABELS: Record<ReservationStatus, string> = {
  pending: '승인 대기',
  approved: '승인',
  rejected: '거절',
  cancelled: '취소',
  completed: '완료',
};

export const RESERVATION_STATUS_COLORS: Record<ReservationStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-600',
  completed: 'bg-blue-100 text-blue-700',
};

export const PROGRAM_STATUS_FLOW: Record<ProgramStatus, ProgramStatus[]> = {
  draft: ['published'],
  published: ['closed'],
  closed: ['archived'],
  archived: [],
};

export const PAGE_SIZE = 20;
