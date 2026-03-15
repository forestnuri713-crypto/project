'use client';

import { useEffect, useState, useCallback } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { api } from '@/services/api';

interface Program {
  id: string;
  title: string;
  approvalStatus: string;
  createdAt: string;
}

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  PENDING_REVIEW: { label: '검수 대기', className: 'bg-yellow-100 text-yellow-800' },
  APPROVED: { label: '승인', className: 'bg-green-100 text-green-800' },
  REJECTED: { label: '거절', className: 'bg-red-100 text-red-800' },
};

export default function MyProgramsPage() {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    api
      .get<Program[]>('/programs/my')
      .then(setPrograms)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <AdminLayout>
      <h2 className="text-xl font-bold mb-6">내 프로그램</h2>
      {loading ? (
        <p className="text-gray-500">로딩 중...</p>
      ) : programs.length === 0 ? (
        <p className="text-gray-500">등록된 프로그램이 없습니다</p>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">프로그램명</th>
                <th className="px-4 py-3 font-medium">승인 상태</th>
                <th className="px-4 py-3 font-medium">등록일</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {programs.map((p) => {
                const status = STATUS_LABELS[p.approvalStatus] ?? {
                  label: p.approvalStatus,
                  className: 'bg-gray-100 text-gray-800',
                };
                return (
                  <tr key={p.id}>
                    <td className="px-4 py-3">{p.title}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium ${status.className}`}
                      >
                        {status.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {new Date(p.createdAt).toLocaleDateString('ko-KR')}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </AdminLayout>
  );
}
