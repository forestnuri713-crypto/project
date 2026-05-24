'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import AdminLayout from '@/components/AdminLayout';
import StatusBadge from '@/components/StatusBadge';
import { supabase } from '@/lib/supabase';
import type { ProgramStatus } from '@/types';
import { PROGRAM_STATUS_LABELS, PROGRAM_STATUS_COLORS } from '@/constants';

interface DashboardData {
  totalPrograms: number;
  publishedPrograms: number;
  totalReservations: number;
  pendingReservations: number;
  statusBreakdown: { status: ProgramStatus; count: number }[];
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [programsRes, reservationsRes, pendingRes] = await Promise.all([
      supabase.from('programs').select('status', { count: 'exact' }).is('deleted_at', null),
      supabase.from('reservations').select('id', { count: 'exact' }).is('deleted_at', null),
      supabase
        .from('reservations')
        .select('id', { count: 'exact' })
        .eq('reservation_status', 'pending')
        .is('deleted_at', null),
    ]);

    const programs = programsRes.data ?? [];
    const statusCounts: Record<string, number> = {};
    programs.forEach((p: { status: string }) => {
      statusCounts[p.status] = (statusCounts[p.status] ?? 0) + 1;
    });

    setData({
      totalPrograms: programsRes.count ?? 0,
      publishedPrograms: statusCounts['published'] ?? 0,
      totalReservations: reservationsRes.count ?? 0,
      pendingReservations: pendingRes.count ?? 0,
      statusBreakdown: (['draft', 'published', 'closed', 'archived'] as ProgramStatus[]).map(
        (s) => ({ status: s, count: statusCounts[s] ?? 0 }),
      ),
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const cards = data
    ? [
        {
          label: '전체 프로그램',
          value: data.totalPrograms,
          href: '/programs',
          linkLabel: '목록 보기',
        },
        {
          label: '공개 중인 프로그램',
          value: data.publishedPrograms,
          href: '/programs',
          linkLabel: '보기',
        },
        {
          label: '전체 예약',
          value: data.totalReservations,
          href: '/reservations',
          linkLabel: '목록 보기',
        },
        {
          label: '승인 대기 예약',
          value: data.pendingReservations,
          href: '/reservations',
          linkLabel: '처리하기',
        },
      ]
    : [];

  return (
    <AdminLayout>
      <h2 className="text-xl font-bold mb-6">대시보드</h2>

      {loading ? (
        <p className="text-sm text-gray-500">로딩 중...</p>
      ) : (
        data && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {cards.map((card) => (
                <div key={card.label} className="bg-white rounded-lg shadow p-5 flex flex-col">
                  <p className="text-sm text-gray-500 mb-1">{card.label}</p>
                  <p className="text-2xl font-bold mb-3">{card.value.toLocaleString()}</p>
                  <Link
                    href={card.href}
                    className="mt-auto text-xs text-green-600 hover:underline"
                  >
                    {card.linkLabel} →
                  </Link>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="font-medium mb-4">프로그램 상태 현황</h3>
              <div className="space-y-3">
                {data.statusBreakdown.map(({ status, count }) => (
                  <div key={status} className="flex items-center gap-3">
                    <StatusBadge
                      label={PROGRAM_STATUS_LABELS[status]}
                      colorClass={PROGRAM_STATUS_COLORS[status]}
                    />
                    <div className="flex-1 bg-gray-100 rounded-full h-3">
                      <div
                        className="bg-green-500 h-3 rounded-full transition-all"
                        style={{
                          width:
                            data.totalPrograms > 0
                              ? `${Math.max((count / data.totalPrograms) * 100, 2)}%`
                              : '0%',
                        }}
                      />
                    </div>
                    <span className="text-sm text-gray-600 w-6 text-right">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )
      )}
    </AdminLayout>
  );
}
