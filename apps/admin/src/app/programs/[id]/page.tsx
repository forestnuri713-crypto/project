'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import AdminLayout from '@/components/AdminLayout';
import StatusBadge from '@/components/StatusBadge';
import { supabase } from '@/lib/supabase';
import type { Program, ProgramStatus } from '@/types';
import {
  PROGRAM_STATUS_LABELS,
  PROGRAM_STATUS_COLORS,
  PROGRAM_STATUS_FLOW,
} from '@/constants';

export default function ProgramDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [program, setProgram] = useState<Program | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const load = async () => {
    const { data, error } = await supabase
      .from('programs')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single();
    if (error || !data) {
      setNotFound(true);
    } else {
      setProgram(data as Program);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleStatusChange = async (newStatus: ProgramStatus) => {
    if (!confirm(`상태를 "${PROGRAM_STATUS_LABELS[newStatus]}"으로 변경하시겠습니까?`)) return;
    await supabase
      .from('programs')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', id);
    load();
  };

  if (loading) {
    return (
      <AdminLayout>
        <p className="text-gray-500">로딩 중...</p>
      </AdminLayout>
    );
  }

  if (notFound || !program) {
    return (
      <AdminLayout>
        <p className="text-gray-500">프로그램을 찾을 수 없습니다</p>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="max-w-3xl">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.back()}
            className="text-gray-500 hover:text-gray-700 text-sm"
          >
            ← 뒤로
          </button>
          <h2 className="text-xl font-bold flex-1">{program.title}</h2>
          <Link
            href={`/programs/${id}/edit`}
            className="px-4 py-2 border text-sm rounded hover:bg-gray-100"
          >
            수정
          </Link>
        </div>

        <div className="bg-white rounded-lg shadow p-6 mb-4">
          <div className="flex items-center gap-3 mb-4">
            <StatusBadge
              label={PROGRAM_STATUS_LABELS[program.status]}
              colorClass={PROGRAM_STATUS_COLORS[program.status]}
            />
            {program.is_featured && (
              <span className="bg-purple-100 text-purple-700 text-xs px-2 py-0.5 rounded">
                추천
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm">
            {program.subtitle && (
              <div className="col-span-2">
                <span className="text-gray-500">부제목</span>
                <p className="mt-0.5 text-gray-900">{program.subtitle}</p>
              </div>
            )}
            {program.description && (
              <div className="col-span-2">
                <span className="text-gray-500">설명</span>
                <p className="mt-0.5 text-gray-900 whitespace-pre-wrap">{program.description}</p>
              </div>
            )}
            <div>
              <span className="text-gray-500">장소</span>
              <p className="mt-0.5">{program.location ?? '-'}</p>
            </div>
            <div>
              <span className="text-gray-500">주소</span>
              <p className="mt-0.5">{program.address ?? '-'}</p>
            </div>
            <div>
              <span className="text-gray-500">시작일</span>
              <p className="mt-0.5">{program.start_date ?? '-'}</p>
            </div>
            <div>
              <span className="text-gray-500">종료일</span>
              <p className="mt-0.5">{program.end_date ?? '-'}</p>
            </div>
            <div>
              <span className="text-gray-500">정원</span>
              <p className="mt-0.5">{program.capacity}명</p>
            </div>
            <div>
              <span className="text-gray-500">현재 예약</span>
              <p className="mt-0.5">{program.current_reservation_count}명</p>
            </div>
          </div>
        </div>

        {PROGRAM_STATUS_FLOW[program.status].length > 0 && (
          <div className="bg-white rounded-lg shadow p-4 mb-4">
            <p className="text-sm font-medium text-gray-700 mb-3">상태 변경</p>
            <div className="flex gap-2">
              {PROGRAM_STATUS_FLOW[program.status].map((nextStatus) => (
                <button
                  key={nextStatus}
                  onClick={() => handleStatusChange(nextStatus)}
                  className="px-4 py-2 text-sm bg-gray-900 text-white rounded hover:bg-gray-700"
                >
                  {PROGRAM_STATUS_LABELS[nextStatus]}으로 변경
                </button>
              ))}
            </div>
          </div>
        )}

        <Link
          href={`/reservations?program_id=${id}`}
          className="text-sm text-blue-600 hover:underline"
        >
          이 프로그램 예약 보기 →
        </Link>
      </div>
    </AdminLayout>
  );
}
