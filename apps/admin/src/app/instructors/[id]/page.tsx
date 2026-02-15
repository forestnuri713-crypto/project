'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import AdminLayout from '@/components/AdminLayout';
import { api, ApiError } from '@/services/api';

type InstructorStatus = 'APPLIED' | 'APPROVED' | 'REJECTED';

type Certification = {
  type: string;
  label: string;
  iconType?: string;
};

type Instructor = {
  id: string;
  email: string;
  name: string;
  role: 'INSTRUCTOR' | string;
  phoneNumber: string | null;
  profileImageUrl: string | null;
  instructorStatus: InstructorStatus;
  instructorStatusReason: string | null;
  certifications: unknown; // backend is JsonValue; normalize client-side
  createdAt: string;
};

function toCertArray(input: unknown): Certification[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((x) => x && typeof x === 'object')
    .map((x: any) => ({
      type: String(x.type ?? ''),
      label: String(x.label ?? ''),
      iconType: x.iconType ? String(x.iconType) : undefined,
    }))
    .filter((x) => x.type && x.label);
}

export default function InstructorDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const router = useRouter();

  const [data, setData] = useState<Instructor | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<{ message: string; requestId: string | null } | null>(null);

  const [saving, setSaving] = useState(false);

  // Reject modal state
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  // Certifications editor
  const [certs, setCerts] = useState<Certification[]>([]);

  const canApproveReject = data?.instructorStatus === 'APPLIED';

  const fetchOne = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setErr(null);
    try {
      const res = await api.get<Instructor>(`/admin/instructors/${id}`);
      setData(res);
      setCerts(toCertArray(res.certifications));
    } catch (e) {
      if (e instanceof ApiError) {
        setErr({ message: e.message, requestId: e.requestId ?? null });
      } else {
        setErr({ message: 'Unknown error', requestId: null });
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchOne();
  }, [fetchOne]);

  const onApprove = useCallback(async () => {
    if (!id) return;
    if (!confirm('승인하시겠습니까?')) return;

    setSaving(true);
    setErr(null);
    try {
      await api.patch(`/admin/instructors/${id}/approve`);
      alert('승인 완료');
      router.push('/instructors');
      router.refresh();
    } catch (e) {
      if (e instanceof ApiError) {
        setErr({ message: e.message, requestId: e.requestId ?? null });
      } else {
        setErr({ message: 'Unknown error', requestId: null });
      }
    } finally {
      setSaving(false);
    }
  }, [id, router]);

  const onReject = useCallback(async () => {
    if (!id) return;

    const reason = rejectReason.trim();
    if (!reason) {
      alert('거절 사유를 입력해주세요.');
      return;
    }
    if (!confirm('거절하시겠습니까?')) return;

    setSaving(true);
    setErr(null);
    try {
      await api.patch(`/admin/instructors/${id}/reject`, { reason });
      alert('거절 완료');
      router.push('/instructors');
      router.refresh();
    } catch (e) {
      if (e instanceof ApiError) {
        setErr({ message: e.message, requestId: e.requestId ?? null });
      } else {
        setErr({ message: 'Unknown error', requestId: null });
      }
    } finally {
      setSaving(false);
      setRejectOpen(false);
      setRejectReason('');
    }
  }, [id, rejectReason, router]);

  const onSaveCerts = useCallback(async () => {
    if (!id) return;

    const payload = {
      certifications: certs
        .map((c) => ({
          type: c.type.trim(),
          label: c.label.trim(),
          iconType: c.iconType?.trim() || undefined,
        }))
        .filter((c) => c.type && c.label),
    };

    if (payload.certifications.length > 10) {
      alert('자격 뱃지는 최대 10개까지 가능합니다.');
      return;
    }

    setSaving(true);
    setErr(null);
    try {
      await api.patch(`/admin/instructors/${id}/certifications`, payload);
      alert('저장 완료');
      await fetchOne();
    } catch (e) {
      if (e instanceof ApiError) {
        setErr({ message: e.message, requestId: e.requestId ?? null });
      } else {
        setErr({ message: 'Unknown error', requestId: null });
      }
    } finally {
      setSaving(false);
    }
  }, [id, certs, fetchOne]);

  const statusBadge = useMemo(() => {
    const s = data?.instructorStatus;
    if (!s) return null;

    const klass =
      s === 'APPLIED'
        ? 'bg-yellow-100 text-yellow-800'
        : s === 'APPROVED'
        ? 'bg-green-100 text-green-800'
        : 'bg-red-100 text-red-800';

    const label = s === 'APPLIED' ? '신청' : s === 'APPROVED' ? '승인' : '거절';

    return <span className={`px-2 py-0.5 rounded text-xs font-medium ${klass}`}>{label}</span>;
  }, [data?.instructorStatus]);

  if (!id) {
    return (
      <AdminLayout>
        <div className="text-sm text-gray-600">Invalid instructor id.</div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold">강사 상세</h2>
        <Link href="/instructors" className="text-sm text-gray-700 hover:underline">
          ← 목록으로
        </Link>
      </div>

      {loading ? (
        <div className="text-sm text-gray-600">로딩 중...</div>
      ) : err ? (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded p-4 text-sm">
          <div className="font-medium">에러</div>
          <div className="mt-1">{err.message}</div>
          {err.requestId ? <div className="mt-1 text-xs">requestId: {err.requestId}</div> : null}
        </div>
      ) : !data ? (
        <div className="text-sm text-gray-600">데이터가 없습니다.</div>
      ) : (
        <div className="space-y-6">
          {/* Profile */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-start justify-between gap-6">
              <div>
                <div className="flex items-center gap-2">
                  <div className="text-lg font-semibold">{data.name}</div>
                  {statusBadge}
                </div>
                <div className="mt-2 text-sm text-gray-700 space-y-1">
                  <div>이메일: {data.email}</div>
                  <div>전화: {data.phoneNumber || '-'}</div>
                  <div>등록일: {new Date(data.createdAt).toISOString().slice(0, 10)}</div>
                  {data.instructorStatus === 'REJECTED' && data.instructorStatusReason ? (
                    <div className="mt-2 text-red-700">
                      거절 사유: <span className="font-medium">{data.instructorStatusReason}</span>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="flex gap-2">
                {canApproveReject ? (
                  <>
                    <button
                      onClick={onApprove}
                      disabled={saving}
                      className="px-3 py-2 rounded bg-green-600 text-white text-sm hover:bg-green-700 disabled:opacity-60"
                    >
                      승인
                    </button>
                    <button
                      onClick={() => setRejectOpen(true)}
                      disabled={saving}
                      className="px-3 py-2 rounded bg-red-600 text-white text-sm hover:bg-red-700 disabled:opacity-60"
                    >
                      거절
                    </button>
                  </>
                ) : null}
              </div>
            </div>
          </div>

          {/* Certifications */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="font-semibold">자격 뱃지</div>
              <button
                onClick={() => setCerts((prev) => [...prev, { type: '', label: '', iconType: '' }])}
                className="px-3 py-1.5 rounded bg-gray-900 text-white text-xs hover:bg-gray-800"
              >
                + 추가
              </button>
            </div>

            <div className="space-y-3">
              {certs.length === 0 ? (
                <div className="text-sm text-gray-600">등록된 뱃지가 없습니다.</div>
              ) : (
                certs.map((c, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                    <input
                      className="col-span-4 border rounded px-3 py-2 text-sm"
                      placeholder="type (e.g. forest_guide)"
                      value={c.type}
                      onChange={(e) =>
                        setCerts((prev) => prev.map((x, i) => (i === idx ? { ...x, type: e.target.value } : x)))
                      }
                    />
                    <input
                      className="col-span-4 border rounded px-3 py-2 text-sm"
                      placeholder="label (e.g. 산림교육전문가)"
                      value={c.label}
                      onChange={(e) =>
                        setCerts((prev) => prev.map((x, i) => (i === idx ? { ...x, label: e.target.value } : x)))
                      }
                    />
                    <input
                      className="col-span-3 border rounded px-3 py-2 text-sm"
                      placeholder="iconType (optional)"
                      value={c.iconType ?? ''}
                      onChange={(e) =>
                        setCerts((prev) =>
                          prev.map((x, i) => (i === idx ? { ...x, iconType: e.target.value } : x)),
                        )
                      }
                    />
                    <button
                      className="col-span-1 text-xs text-red-700 hover:underline"
                      onClick={() => setCerts((prev) => prev.filter((_, i) => i !== idx))}
                    >
                      삭제
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="mt-4">
              <button
                onClick={onSaveCerts}
                disabled={saving}
                className="px-4 py-2 rounded bg-gray-900 text-white text-sm hover:bg-gray-800 disabled:opacity-60"
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject modal */}
      {rejectOpen ? (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow w-full max-w-lg p-6">
            <div className="text-lg font-semibold">거절 사유</div>
            <div className="mt-3">
              <textarea
                className="w-full border rounded p-3 text-sm min-h-[120px]"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="거절 사유를 입력하세요 (필수)"
              />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                className="px-3 py-2 rounded border text-sm"
                onClick={() => {
                  setRejectOpen(false);
                  setRejectReason('');
                }}
              >
                취소
              </button>
              <button
                className="px-3 py-2 rounded bg-red-600 text-white text-sm hover:bg-red-700"
                onClick={onReject}
              >
                거절 확정
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </AdminLayout>
  );
}
