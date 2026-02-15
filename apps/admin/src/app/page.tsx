'use client';

import { useEffect, useState, useCallback } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { api, ApiError } from '@/services/api';

interface DashboardStats {
  totalUsers: number;
  totalReservations: number;
  totalRevenue: number;
  pendingPrograms: number;
  pendingInstructors: number;
}

interface ErrorState {
  message: string;
  code: string | null;
  requestId: string | null;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ErrorState | null>(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<DashboardStats>('/admin/dashboard/stats');
      setStats(data);
    } catch (e) {
      if (e instanceof ApiError) {
        setError({ message: e.message, code: e.code, requestId: e.requestId });
      } else {
        setError({ message: '대시보드 통계를 불러오지 못했습니다', code: null, requestId: null });
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const cards = stats
    ? [
        { label: '전체 유저', value: stats.totalUsers.toLocaleString() },
        { label: '총 예약', value: stats.totalReservations.toLocaleString() },
        { label: '총 매출', value: `${stats.totalRevenue.toLocaleString()}원` },
        { label: '승인 대기 프로그램', value: stats.pendingPrograms.toLocaleString() },
        { label: '강사 신청 대기', value: stats.pendingInstructors.toLocaleString() },
      ]
    : [];

  return (
    <AdminLayout>
      <h2 className="text-xl font-bold mb-6">대시보드</h2>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded p-4 text-sm mb-6">
          <div className="font-medium">오류</div>
          <div>{error.message}</div>
          {error.code && (
            <div className="text-xs mt-1">code: {error.code}</div>
          )}
          {error.requestId && (
            <div className="text-xs mt-1">requestId: {error.requestId}</div>
          )}
          <button
            onClick={fetchStats}
            className="mt-3 px-3 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700"
          >
            다시 시도
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">로딩 중...</p>
      ) : !error && stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {cards.map((card) => (
            <div key={card.label} className="bg-white rounded-lg shadow p-6">
              <p className="text-sm text-gray-500 mb-1">{card.label}</p>
              <p className="text-2xl font-bold">{card.value}</p>
            </div>
          ))}
        </div>
      )}
    </AdminLayout>
  );
}
