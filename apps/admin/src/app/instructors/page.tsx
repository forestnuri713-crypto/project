'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import AdminLayout from '@/components/AdminLayout';
import Pagination from '@/components/Pagination';
import ErrorPanel from '@/components/ErrorPanel';
import StatusBadge from '@/components/StatusBadge';
import { useListData } from '@/hooks';
import type { AdminInstructor, InstructorStatus } from '@/types';

function certsCount(certs: unknown): number {
  if (Array.isArray(certs)) return certs.length;
  if (certs && typeof certs === 'object') {
    const v = Object.values(certs as Record<string, unknown>);
    return Array.isArray(v) ? v.length : 0;
  }
  return 0;
}

export default function InstructorsPage() {
  const [tab, setTab] = useState<'ALL' | InstructorStatus>('APPLIED');
  const [search, setSearch] = useState('');

  const filters = useMemo(() => {
    const f: Record<string, string> = {};
    if (tab !== 'ALL') f.instructorStatus = tab;
    if (search.trim()) f.search = search.trim();
    return f;
  }, [tab, search]);

  const { data, loading, error, page, setPage, reload } = useListData<AdminInstructor>({
    endpoint: '/admin/instructors',
    filters,
  });

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold">강사 관리</h2>
      </div>

      <div className="mb-4 flex gap-2 items-center flex-wrap">
        <div className="flex gap-2">
          {(['ALL', 'APPLIED', 'APPROVED', 'REJECTED'] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setTab(k)}
              className={`px-3 py-1.5 rounded text-sm border ${
                tab === k
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-900 border-gray-200'
              }`}
            >
              {k === 'ALL' ? '전체' : k === 'APPLIED' ? '신청' : k === 'APPROVED' ? '승인' : '거절'}
            </button>
          ))}
        </div>

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="이름/이메일 검색"
          className="border rounded px-3 py-1.5 text-sm w-64"
        />

        <button
          type="button"
          onClick={reload}
          className="px-3 py-1.5 rounded text-sm bg-gray-100 hover:bg-gray-200"
        >
          새로고침
        </button>
      </div>

      {error && <ErrorPanel error={error} onRetry={reload} />}

      {loading ? (
        <div className="text-sm text-gray-600">로딩 중...</div>
      ) : !data || data.items.length === 0 ? (
        <div className="text-sm text-gray-600">결과가 없습니다.</div>
      ) : (
        <>
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-700">
                <tr>
                  <th className="px-4 py-3 font-medium text-left">이름</th>
                  <th className="px-4 py-3 font-medium text-left">이메일</th>
                  <th className="px-4 py-3 font-medium text-left">전화번호</th>
                  <th className="px-4 py-3 font-medium text-left">상태</th>
                  <th className="px-4 py-3 font-medium text-left">자격증</th>
                  <th className="px-4 py-3 font-medium text-left">등록일</th>
                  <th className="px-4 py-3 font-medium text-left">액션</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((i) => (
                  <tr key={i.id} className="border-t">
                    <td className="px-4 py-3">{i.name}</td>
                    <td className="px-4 py-3">{i.email}</td>
                    <td className="px-4 py-3">{i.phoneNumber || '-'}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={i.instructorStatus} variant="instructor" />
                    </td>
                    <td className="px-4 py-3">{certsCount(i.certifications)}</td>
                    <td className="px-4 py-3">
                      {new Date(i.createdAt).toISOString().slice(0, 10)}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/instructors/${i.id}`}
                        className="px-3 py-1 bg-gray-900 text-white rounded text-xs hover:bg-gray-800"
                      >
                        상세
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4">
            <Pagination
              page={page}
              total={data.total}
              pageSize={data.limit ?? 20}
              onChange={setPage}
            />
          </div>
        </>
      )}
    </AdminLayout>
  );
}
