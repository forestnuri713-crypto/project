'use client';

import { useEffect, useState, useCallback } from 'react';
import AdminLayout from '@/components/AdminLayout';
import Pagination from '@/components/Pagination';
import { api } from '@/services/api';

interface Program {
  id: string;
  title: string;
  approvalStatus: string;
  createdAt: string;
  instructor: { id: string; name: string; email: string };
}

interface ProgramsResponse {
  items: Program[];
  total: number;
  page: number;
  limit: number;
}

export default function ProgramsPendingPage() {
  const [data, setData] = useState<ProgramsResponse | null>(null);
  const [page, setPage] = useState(1);

  const load = useCallback(() => {
    api
      .get<ProgramsResponse>(
        `/admin/programs?approvalStatus=PENDING_REVIEW&page=${page}&limit=20`,
      )
      .then(setData);
  }, [page]);

  useEffect(() => {
    load();
  }, [load]);

  const handleApprove = async (id: string) => {
    if (!confirm('승인하시겠습니까?')) return;
    await api.patch(`/admin/programs/${id}/approve`);
    load();
  };

  const handleReject = async (id: string) => {
    const reason = prompt('거절 사유를 입력하세요');
    if (!reason) return;
    await api.patch(`/admin/programs/${id}/reject`, { rejectionReason: reason });
    load();
  };

  return (
    <AdminLayout>
      <h2 className="text-xl font-bold mb-6">승인 대기 프로그램</h2>
      {!data ? (
        <p className="text-gray-500">로딩 중...</p>
      ) : data.items.length === 0 ? (
        <p className="text-gray-500">대기 중인 프로그램이 없습니다</p>
      ) : (
        <>
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left">
                <tr>
                  <th className="px-4 py-3 font-medium">프로그램명</th>
                  <th className="px-4 py-3 font-medium">강사</th>
                  <th className="px-4 py-3 font-medium">등록일</th>
                  <th className="px-4 py-3 font-medium">작업</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.items.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-3">{p.title}</td>
                    <td className="px-4 py-3">{p.instructor.name}</td>
                    <td className="px-4 py-3">
                      {new Date(p.createdAt).toLocaleDateString('ko-KR')}
                    </td>
                    <td className="px-4 py-3 space-x-2">
                      <button
                        onClick={() => handleApprove(p.id)}
                        className="px-3 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700"
                      >
                        승인
                      </button>
                      <button
                        onClick={() => handleReject(p.id)}
                        className="px-3 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700"
                      >
                        거절
                      </button>
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
