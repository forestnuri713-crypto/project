'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import AdminLayout from '@/components/AdminLayout';
import StatusBadge from '@/components/StatusBadge';
import { supabase } from '@/lib/supabase';
import type { Program, ProgramStatus } from '@/types';
import {
  PROGRAM_STATUS_LABELS,
  PROGRAM_STATUS_COLORS,
  PROGRAM_STATUS_FLOW,
  PAGE_SIZE,
} from '@/constants';

const STATUS_TABS: { value: ProgramStatus | 'all'; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'draft', label: '작성 중' },
  { value: 'published', label: '공개' },
  { value: 'closed', label: '마감' },
  { value: 'archived', label: '종료' },
];

export default function ProgramsPage() {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<ProgramStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('programs')
      .select('*', { count: 'exact' })
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

    if (statusFilter !== 'all') query = query.eq('status', statusFilter);
    if (search) query = query.ilike('title', `%${search}%`);

    const { data, count, error } = await query;
    if (!error) {
      setPrograms(data ?? []);
      setTotal(count ?? 0);
    }
    setLoading(false);
  }, [page, statusFilter, search]);

  useEffect(() => {
    load();
  }, [load]);

  const handleStatusChange = async (id: string, newStatus: ProgramStatus) => {
    if (!confirm(`상태를 "${PROGRAM_STATUS_LABELS[newStatus]}"으로 변경하시겠습니까?`)) return;
    await supabase
      .from('programs')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', id);
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('프로그램을 삭제하시겠습니까?')) return;
    await supabase
      .from('programs')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);
    load();
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold">프로그램 관리</h2>
        <Link
          href="/programs/create"
          className="px-4 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700"
        >
          + 프로그램 등록
        </Link>
      </div>

      <div className="flex gap-2 mb-4">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => {
              setStatusFilter(tab.value);
              setPage(1);
            }}
            className={`px-3 py-1.5 text-sm rounded border ${
              statusFilter === tab.value ? 'bg-gray-900 text-white' : 'hover:bg-gray-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mb-4">
        <input
          type="text"
          placeholder="프로그램명 검색"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              setPage(1);
              load();
            }
          }}
          className="w-80 px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        />
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">제목</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">상태</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">예약/정원</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">시작일</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">종료일</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">액션</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  로딩 중...
                </td>
              </tr>
            ) : programs.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  프로그램이 없습니다
                </td>
              </tr>
            ) : (
              programs.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/programs/${p.id}`}
                      className="font-medium text-gray-900 hover:text-green-600"
                    >
                      {p.title}
                    </Link>
                    {p.subtitle && <p className="text-xs text-gray-400">{p.subtitle}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge
                      label={PROGRAM_STATUS_LABELS[p.status]}
                      colorClass={PROGRAM_STATUS_COLORS[p.status]}
                    />
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {p.current_reservation_count} / {p.capacity}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{p.start_date ?? '-'}</td>
                  <td className="px-4 py-3 text-gray-600">{p.end_date ?? '-'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link
                        href={`/programs/${p.id}/edit`}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        수정
                      </Link>
                      {PROGRAM_STATUS_FLOW[p.status].map((nextStatus) => (
                        <button
                          key={nextStatus}
                          onClick={() => handleStatusChange(p.id, nextStatus)}
                          className="text-xs text-gray-600 hover:underline"
                        >
                          {PROGRAM_STATUS_LABELS[nextStatus]}으로 변경
                        </button>
                      ))}
                      {p.status !== 'archived' && (
                        <button
                          onClick={() => handleDelete(p.id)}
                          className="text-xs text-red-500 hover:underline"
                        >
                          삭제
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

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1 text-sm border rounded disabled:opacity-40 hover:bg-gray-100"
          >
            이전
          </button>
          <span className="px-3 py-1 text-sm">
            {page} / {totalPages}
          </span>
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
