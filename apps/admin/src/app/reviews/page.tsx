'use client';

import { useState, useMemo } from 'react';
import AdminLayout from '@/components/AdminLayout';
import Pagination from '@/components/Pagination';
import ErrorPanel from '@/components/ErrorPanel';
import StatusBadge from '@/components/StatusBadge';
import { api } from '@/services/api';
import { useListData } from '@/hooks';
import type { AdminReview } from '@/types';

export default function ReviewsPage() {
  const [statusFilter, setStatusFilter] = useState('');
  const [ratingFilter, setRatingFilter] = useState('');

  const filters = useMemo(
    () => ({ status: statusFilter, rating: ratingFilter }),
    [statusFilter, ratingFilter],
  );

  const { data, loading, error, page, setPage, reload } = useListData<AdminReview>({
    endpoint: '/admin/reviews',
    filters,
  });

  const handleSetStatus = async (id: string, newStatus: 'VISIBLE' | 'HIDDEN') => {
    await api.patch(`/admin/reviews/${id}/status`, { status: newStatus });
    reload();
  };

  const renderStars = (rating: number) =>
    '★'.repeat(rating) + '☆'.repeat(5 - rating);

  return (
    <AdminLayout>
      <h2 className="text-xl font-bold mb-6">리뷰 관리</h2>

      <div className="flex gap-3 mb-4">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border rounded px-3 py-1.5 text-sm"
        >
          <option value="">전체 상태</option>
          <option value="VISIBLE">공개</option>
          <option value="HIDDEN">숨김</option>
        </select>
        <select
          value={ratingFilter}
          onChange={(e) => setRatingFilter(e.target.value)}
          className="border rounded px-3 py-1.5 text-sm"
        >
          <option value="">전체 별점</option>
          {[5, 4, 3, 2, 1].map((r) => (
            <option key={r} value={r}>
              {r}점
            </option>
          ))}
        </select>
      </div>

      {error && <ErrorPanel error={error} onRetry={reload} />}

      {loading ? (
        <p className="text-gray-500">로딩 중...</p>
      ) : !data || data.items.length === 0 ? (
        <p className="text-gray-500">리뷰가 없습니다</p>
      ) : (
        <>
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left">
                <tr>
                  <th className="px-4 py-3 font-medium">프로그램</th>
                  <th className="px-4 py-3 font-medium">작성자</th>
                  <th className="px-4 py-3 font-medium">별점</th>
                  <th className="px-4 py-3 font-medium">코멘트</th>
                  <th className="px-4 py-3 font-medium">상태</th>
                  <th className="px-4 py-3 font-medium">작성일</th>
                  <th className="px-4 py-3 font-medium">작업</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.items.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-3">{r.program?.title}</td>
                    <td className="px-4 py-3">{r.parentUser?.name}</td>
                    <td className="px-4 py-3 text-yellow-500">{renderStars(r.rating)}</td>
                    <td className="px-4 py-3 max-w-xs truncate">{r.comment}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={r.status} variant="review" />
                    </td>
                    <td className="px-4 py-3">
                      {new Date(r.createdAt).toLocaleDateString('ko-KR')}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() =>
                          handleSetStatus(r.id, r.status === 'VISIBLE' ? 'HIDDEN' : 'VISIBLE')
                        }
                        className={`px-3 py-1 rounded text-xs ${
                          r.status === 'VISIBLE'
                            ? 'bg-red-600 text-white hover:bg-red-700'
                            : 'bg-green-600 text-white hover:bg-green-700'
                        }`}
                      >
                        {r.status === 'VISIBLE' ? '숨김' : '해제'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={page}
            total={data.total}
            pageSize={data.limit ?? 20}
            onChange={setPage}
          />
        </>
      )}
    </AdminLayout>
  );
}
