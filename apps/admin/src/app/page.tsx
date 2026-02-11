'use client';

import { useEffect, useState } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { api } from '@/services/api';

interface DashboardStats {
  totalUsers: number;
  totalReservations: number;
  totalRevenue: number;
  pendingPrograms: number;
  pendingInstructors: number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    api.get<DashboardStats>('/admin/dashboard/stats').then(setStats);
  }, []);

  const cards = stats
    ? [
        { label: '전체 유저', value: stats.totalUsers.toLocaleString() },
        { label: '총 예약', value: stats.totalReservations.toLocaleString() },
        { label: '총 매출', value: `${stats.totalRevenue.toLocaleString()}원` },
        { label: '승인 대기 프로그램', value: stats.pendingPrograms },
        { label: '강사 신청 대기', value: stats.pendingInstructors },
      ]
    : [];

  return (
    <AdminLayout>
      <h2 className="text-xl font-bold mb-6">대시보드</h2>
      {!stats ? (
        <p className="text-gray-500">로딩 중...</p>
      ) : (
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
