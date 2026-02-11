'use client';

import { useEffect, useState, useCallback } from 'react';
import AdminLayout from '@/components/AdminLayout';
import Pagination from '@/components/Pagination';
import { api } from '@/services/api';

interface Settlement {
  id: string;
  providerId: string;
  instructorId: string;
  totalAmount: number;
  status: string;
  periodStart: string;
  periodEnd: string;
  createdAt: string;
}

interface SettlementsResponse {
  items: Settlement[];
  total: number;
  page: number;
  limit: number;
}

const STATUS_OPTIONS = ['', 'PENDING', 'CONFIRMED', 'PAID'];
const STATUS_LABELS: Record<string, string> = {
  '': '전체',
  PENDING: '대기',
  CONFIRMED: '확인',
  PAID: '지급완료',
};

export default function SettlementsPage() {
  const [data, setData] = useState<SettlementsResponse | null>(null);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');

  const load = useCallback(() => {
    const params = new URLSearchParams({ page: String(page), limit: '20' });
    if (status) params.set('status', status);
    api.get<SettlementsResponse>(`/admin/settlements?${params}`).then(setData);
  }, [page, status]);

  useEffect(() => {
    load();
  }, [load]);

  const handlePay = async (id: string) => {
    if (!confirm('지급 처리하시겠습니까?')) return;
    await api.patch(`/admin/settlements/${id}/pay`);
    load();
  };

  return (
    <AdminLayout>
      <h2 className="text-xl font-bold mb-6">정산 관리</h2>
      <div className="mb-4 flex gap-2">
        {STATUS_OPTIONS.map((s) => (
          <button
            key={s}
            onClick={() => {
              setStatus(s);
              setPage(1);
            }}
            className={`px-3 py-1.5 text-sm rounded border ${
              status === s ? 'bg-gray-900 text-white' : 'hover:bg-gray-100'
            }`}
          >
            {STATUS_LABELS[s]}
          </button>
        ))}
      </div>
      {!data ? (
        <p className="text-gray-500">로딩 중...</p>
      ) : data.items.length === 0 ? (
        <p className="text-gray-500">정산 내역이 없습니다</p>
      ) : (
        <>
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left">
                <tr>
                  <th className="px-4 py-3 font-medium">기간</th>
                  <th className="px-4 py-3 font-medium">금액</th>
                  <th className="px-4 py-3 font-medium">상태</th>
                  <th className="px-4 py-3 font-medium">작업</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.items.map((s) => (
                  <tr key={s.id}>
                    <td className="px-4 py-3">
                      {new Date(s.periodStart).toLocaleDateString('ko-KR')} ~{' '}
                      {new Date(s.periodEnd).toLocaleDateString('ko-KR')}
                    </td>
                    <td className="px-4 py-3">{s.totalAmount.toLocaleString()}원</td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium ${
                          s.status === 'PAID'
                            ? 'bg-green-100 text-green-800'
                            : s.status === 'CONFIRMED'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {STATUS_LABELS[s.status] || s.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {s.status !== 'PAID' && (
                        <button
                          onClick={() => handlePay(s.id)}
                          className="px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
                        >
                          지급 처리
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={data.page}
            total={data.total}
            pageSize={data.limit}
            onChange={setPage}
          />
        </>
      )}
    </AdminLayout>
  );
}
