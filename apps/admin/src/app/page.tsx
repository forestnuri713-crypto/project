'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
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

// ─── Drill-down mapping ──────────────────────────────
// Only cards with existing admin pages get an href.
// Others are disabled (no backend endpoint / page to link to).

interface CardConfig {
  key: keyof DashboardStats;
  label: string;
  format: (v: number) => string;
  href: string | null;         // null = disabled (no target page)
  hrefLabel: string | null;    // button text
  disabledReason: string | null; // shown when href is null (SSOT §4.3)
  color: string;               // bar color for visualization
}

const CARD_CONFIGS: CardConfig[] = [
  {
    key: 'totalUsers',
    label: '전체 유저',
    format: (v) => v.toLocaleString(),
    href: '/users',
    hrefLabel: '유저 목록',
    disabledReason: null,
    color: 'bg-blue-500',
  },
  {
    key: 'totalReservations',
    label: '총 예약',
    format: (v) => v.toLocaleString(),
    href: null,
    hrefLabel: null,
    disabledReason: '예약 목록 페이지 및 endpoint 없음',
    color: 'bg-green-500',
  },
  {
    key: 'totalRevenue',
    label: '총 매출',
    format: (v) => `${v.toLocaleString()}원`,
    href: null,
    hrefLabel: null,
    disabledReason: '매출 상세 페이지 및 endpoint 없음',
    color: 'bg-yellow-500',
  },
  {
    key: 'pendingPrograms',
    label: '승인 대기 프로그램',
    format: (v) => v.toLocaleString(),
    href: '/programs/pending',
    hrefLabel: '대기 목록',
    disabledReason: null,
    color: 'bg-orange-500',
  },
  {
    key: 'pendingInstructors',
    label: '강사 신청 대기',
    format: (v) => v.toLocaleString(),
    href: '/instructors',
    hrefLabel: '강사 목록',
    disabledReason: null,
    color: 'bg-red-500',
  },
];

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

  // M2: Compute max value for proportional bar widths (no derived metrics — just layout scaling)
  const maxValue = stats
    ? Math.max(...CARD_CONFIGS.map((c) => stats[c.key]), 1)
    : 1;

  return (
    <AdminLayout>
      <h2 className="text-xl font-bold mb-6">대시보드</h2>

      {/* Error Panel */}
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
        <>
          {/* Metric Cards with Drill-down (M1) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {CARD_CONFIGS.map((card) => (
              <div key={card.key} className="bg-white rounded-lg shadow p-6 flex flex-col justify-between">
                <div>
                  <p className="text-sm text-gray-500 mb-1">{card.label}</p>
                  <p className="text-2xl font-bold">{card.format(stats[card.key])}</p>
                </div>
                {card.href ? (
                  <Link
                    href={card.href}
                    className="mt-3 inline-block text-xs text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    {card.hrefLabel} →
                  </Link>
                ) : (
                  <span
                    className="mt-3 inline-block text-xs text-gray-400 cursor-not-allowed"
                    title={card.disabledReason ?? '상세 페이지 없음'}
                  >
                    {card.disabledReason ?? '상세 보기 불가'}
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Visualization: Horizontal Bar Chart (M2) */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="font-medium mb-4">통계 요약</h3>
            <div className="space-y-3">
              {CARD_CONFIGS.map((card) => {
                const value = stats[card.key];
                const widthPercent = maxValue > 0 ? Math.max((value / maxValue) * 100, 2) : 2;
                return (
                  <div key={card.key}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">{card.label}</span>
                      <span className="font-medium">{card.format(value)}</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-4">
                      <div
                        className={`${card.color} h-4 rounded-full transition-all`}
                        style={{ width: `${widthPercent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </AdminLayout>
  );
}
