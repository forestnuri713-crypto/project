'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import AdminLayout from '@/components/AdminLayout';
import StatusBadge from '@/components/StatusBadge';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import type { Reservation, ReservationStatus } from '@/types';
import {
  RESERVATION_STATUS_LABELS,
  RESERVATION_STATUS_COLORS,
  PAGE_SIZE,
} from '@/constants';

const STATUS_TABS: { value: ReservationStatus | 'all'; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'pending', label: '승인 대기' },
  { value: 'approved', label: '승인' },
  { value: 'rejected', label: '거절' },
  { value: 'cancelled', label: '취소' },
  { value: 'completed', label: '완료' },
];

function ReservationsContent() {
  const searchParams = useSearchParams();
  const programIdFilter = searchParams.get('program_id');
  const { user } = useAuth();

  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<ReservationStatus | 'all'>('all');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('reservations')
      .select(`
        *,
        user:users(id, name, email),
        program:programs(id, title)
      `, { count: 'exact' })
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

    if (statusFilter !== 'all') query = query.eq('reservation_status', statusFilter);
    if (programIdFilter) query = query.eq('program_id', programIdFilter);

    const { data, count, error } = await query;
    if (!error) {
      setReservations((data ?? []) as Reservation[]);
      setTotal(count ?? 0);
    }
    setLoading(false);
  }, [page, statusFilter, programIdFilter]);

  useEffect(() => { load(); }, [load]);

  const handleApprove = async (id: string) => {
    if (!confirm('승인하시겠습니까?')) return;
    await supabase.from('reservations').update({
      reservation_status: 'approved',
      approved_by: user?.id,
      approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', id);
    load();
  };

  const handleReject = async (id: string) => {
    const memo = prompt('거절 사유를 입력하세요 (선택)');
    await supabase.from('reservations').update({
      reservation_status: 'rejected',
      memo: memo ?? undefined,
      updated_at: new Date().toISOString(),
    }).eq('id', id);
    load();
  };

  const handleComplete = async (id: string) => {
    if (!confirm('완료 처리하시겠습니까?')) return;
    await supabase.from('reservations').update({
      reservation_status: 'completed',
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', id);
    load();
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold">
          예약 관리
          {programIdFilter && <span className="text-sm font-normal text-gray-500 ml-2">(프로그램 필터 적용)</span>}
        </h2>
        {programIdFilter && (
          <Link href="/reservations" className="text-sm text-blue-600 hover:underline">필터 해제</Link>
        )}
      </div>

      {/* Status Tabs */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => { setStatusFilter(tab.value); setPage(1); }}
            className={`px-3 py-1.5 text-sm rounded border ${
              statusFilter === tab.value ? 'bg-gray-900 text-white' : 'hover:bg-gray-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">예약자</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">프로그램</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">상태</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">참가 인원</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">신청일</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">액션</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">로딩 중...</td></tr>
            ) : reservations.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">예약이 없습니다</td></tr>
            ) : (
              reservations.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{r.user?.name ?? '-'}</p>
                    <p className="text-xs text-gray-400">{r.user?.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    {r.program ? (
                      <Link href={`/programs/${r.program.id}`} className="text-blue-600 hover:underline">
                        {r.program.title}
                      </Link>
                    ) : '-'}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge
                      label={RESERVATION_STATUS_LABELS[r.reservation_status]}
                      colorClass={RESERVATION_STATUS_COLORS[r.reservation_status]}
                    />
                    {r.memo && <p className="text-xs text-gray-400 mt-0.5">{r.memo}</p>}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{r.participant_count}명</td>
                  <td className="px-4 py-3 text-gray-600">
                    {new Date(r.created_at).toLocaleDateString('ko-KR')}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      {r.reservation_status === 'pending' && (
                        <>
                          <button
                            onClick={() => handleApprove(r.id)}
                            className="text-xs text-green-600 hover:underline"
                          >
                            승인
                          </button>
                          <button
                            onClick={() => handleReject(r.id)}
                            className="text-xs text-red-500 hover:underline"
                          >
                            거절
                          </button>
                        </>
                      )}
                      {r.reservation_status === 'approved' && (
                        <button
                          onClick={() => handleComplete(r.id)}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          완료 처리
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1 text-sm border rounded disabled:opacity-40 hover:bg-gray-100"
          >
            이전
          </button>
          <span className="px-3 py-1 text-sm">{page} / {totalPages}</span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1 text-sm border rounded disabled:opacity-40 hover:bg-gray-100"
          >
            다음
          </button>
        </div>
      )}
    </AdminLayout>
  );
}

export default function ReservationsPage() {
  return (
    <Suspense fallback={<AdminLayout><p className="text-gray-500">로딩 중...</p></AdminLayout>}>
      <ReservationsContent />
    </Suspense>
  );
}
