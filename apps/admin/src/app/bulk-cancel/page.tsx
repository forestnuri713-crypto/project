'use client';

import { useEffect, useState, useCallback } from 'react';
import AdminLayout from '@/components/AdminLayout';
import Pagination from '@/components/Pagination';
import { api, ApiError } from '@/services/api';

// ─── Types ───────────────────────────────────────────

interface Program {
  id: string;
  title: string;
  approvalStatus: string;
  createdAt: string;
  instructor: { id: string; name: string; email: string } | null;
}

interface ProgramsResponse {
  items: Program[];
  total: number;
  page: number;
  limit: number;
}

interface EstimatedRefund {
  reservationId: string;
  userId: string;
  totalPrice: number;
  estimatedRefund: number;
}

interface DryRunResult {
  dryRun: true;
  mode: string;
  sessionId: string;
  totalTargets: number;
  estimatedRefunds: EstimatedRefund[];
}

interface CreatedJob {
  id: string;
  sessionId: string;
  reason: string;
  mode: string;
  status: string;
  totalTargets: number;
}

interface JobSummary {
  id: string;
  sessionId: string;
  reason: string;
  mode: string;
  status: string;
  totalTargets: number;
  successCount: number;
  failedCount: number;
  skippedCount: number;
  startedAt: string | null;
  finishedAt: string | null;
  program: { id: string; title: string; scheduleAt: string } | null;
}

interface ErrorState {
  message: string;
  code: string | null;
  requestId: string | null;
}

// ─── Constants ───────────────────────────────────────

const REFUND_PREVIEW_LIMIT = 20;

// ─── Component ───────────────────────────────────────

export default function BulkCancelPage() {
  // Program selection state
  const [programs, setPrograms] = useState<ProgramsResponse | null>(null);
  const [programPage, setProgramPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [selectedProgram, setSelectedProgram] = useState<Program | null>(null);
  const [loadingPrograms, setLoadingPrograms] = useState(false);

  // Form state
  const [reason, setReason] = useState('');

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [dryRunResult, setDryRunResult] = useState<DryRunResult | null>(null);

  // Execution state (Milestone 3)
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [jobResult, setJobResult] = useState<JobSummary | null>(null);

  // Error state
  const [error, setError] = useState<ErrorState | null>(null);

  // ─── Fetch programs ──────────────────────────────────

  const fetchPrograms = useCallback(async () => {
    setLoadingPrograms(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('page', String(programPage));
      params.set('limit', '20');
      if (search) params.set('search', search);

      const data = await api.get<ProgramsResponse>(
        `/admin/programs?${params.toString()}`,
      );
      setPrograms(data);
    } catch (e) {
      if (e instanceof ApiError) {
        setError({
          message: e.message,
          code: e.code,
          requestId: e.requestId,
        });
      } else {
        setError({ message: '프로그램 목록을 불러오지 못했습니다', code: null, requestId: null });
      }
    } finally {
      setLoadingPrograms(false);
    }
  }, [programPage, search]);

  useEffect(() => {
    fetchPrograms();
  }, [fetchPrograms]);

  // ─── Search with debounce ────────────────────────────

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setProgramPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // ─── Submit dry run ──────────────────────────────────

  const handleDryRun = useCallback(async () => {
    if (!selectedProgram) return;
    if (!reason.trim()) {
      setError({ message: '취소 사유를 입력해 주세요', code: null, requestId: null });
      return;
    }

    setSubmitting(true);
    setError(null);
    setDryRunResult(null);

    try {
      // NOTE: The backend route is POST /admin/sessions/:sessionId/bulk-cancel
      // but :sessionId is a legacy param name — it actually maps to programId.
      // In the backend, BulkCancelJob.sessionId references Program.id via Prisma relation.
      const result = await api.post<DryRunResult>(
        `/admin/sessions/${selectedProgram.id}/bulk-cancel`,
        { reason: reason.trim(), dryRun: true },
      );
      setDryRunResult(result);
    } catch (e) {
      if (e instanceof ApiError) {
        setError({
          message: e.message,
          code: e.code,
          requestId: e.requestId,
        });
      } else {
        setError({ message: '일괄 취소 미리보기에 실패했습니다', code: null, requestId: null });
      }
    } finally {
      setSubmitting(false);
    }
  }, [selectedProgram, reason]);

  // ─── Execute job (Milestone 3) ─────────────────────

  const handleExecute = useCallback(async () => {
    if (!selectedProgram || !reason.trim()) return;

    setExecuting(true);
    setError(null);
    setConfirmModalOpen(false);

    try {
      // Step 1: Create the real job (dryRun: false)
      // NOTE: :sessionId is a legacy param name — it maps to programId.
      const created = await api.post<CreatedJob>(
        `/admin/sessions/${selectedProgram.id}/bulk-cancel`,
        { reason: reason.trim() },
      );

      // Step 2: Start the job
      await api.post(`/admin/bulk-cancel-jobs/${created.id}/start`);

      // Step 3: Fetch the completed summary
      const summary = await api.get<JobSummary>(
        `/admin/bulk-cancel-jobs/${created.id}`,
      );
      setJobResult(summary);
    } catch (e) {
      if (e instanceof ApiError) {
        setError({
          message: e.message,
          code: e.code,
          requestId: e.requestId,
        });
      } else {
        setError({ message: '일괄 취소 실행에 실패했습니다', code: null, requestId: null });
      }
    } finally {
      setExecuting(false);
    }
  }, [selectedProgram, reason]);

  // ─── Reset ───────────────────────────────────────────

  const handleReset = () => {
    setSelectedProgram(null);
    setReason('');
    setDryRunResult(null);
    setJobResult(null);
    setConfirmModalOpen(false);
    setError(null);
  };

  // ─── Render ──────────────────────────────────────────

  return (
    <AdminLayout>
      <h2 className="text-xl font-bold mb-6">일괄 취소</h2>

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
        </div>
      )}

      {/* Step 1: Program Selection */}
      {!selectedProgram && (
        <div className="space-y-4">
          <div>
            <input
              type="text"
              placeholder="프로그램명 또는 강사명 검색..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="border rounded px-3 py-2 text-sm w-full max-w-md"
            />
          </div>

          {loadingPrograms ? (
            <p className="text-sm text-gray-500">로딩 중...</p>
          ) : !programs || programs.items.length === 0 ? (
            <p className="text-sm text-gray-500">프로그램이 없습니다</p>
          ) : (
            <>
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-left">
                    <tr>
                      <th className="px-4 py-3 font-medium">프로그램명</th>
                      <th className="px-4 py-3 font-medium">강사</th>
                      <th className="px-4 py-3 font-medium">상태</th>
                      <th className="px-4 py-3 font-medium">등록일</th>
                      <th className="px-4 py-3 font-medium">선택</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {programs.items.map((p) => (
                      <tr key={p.id}>
                        <td className="px-4 py-3">{p.title}</td>
                        <td className="px-4 py-3">
                          {p.instructor?.name ?? '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                            {p.approvalStatus}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {new Date(p.createdAt).toLocaleDateString('ko-KR')}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => {
                              setSelectedProgram(p);
                              setError(null);
                              setDryRunResult(null);
                            }}
                            className="px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
                          >
                            선택
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination
                page={programs.page}
                total={programs.total}
                pageSize={programs.limit}
                onChange={setProgramPage}
              />
            </>
          )}
        </div>
      )}

      {/* Step 2: Reason + Dry Run */}
      {selectedProgram && !dryRunResult && (
        <div className="space-y-4">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="font-medium mb-4">선택된 프로그램</h3>
            <div className="text-sm space-y-1">
              <div>
                <span className="text-gray-500">프로그램:</span>{' '}
                {selectedProgram.title}
              </div>
              <div>
                <span className="text-gray-500">강사:</span>{' '}
                {selectedProgram.instructor?.name ?? '—'}
              </div>
              <div>
                <span className="text-gray-500">ID:</span>{' '}
                <span className="font-mono text-xs">{selectedProgram.id}</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <label className="block text-sm font-medium mb-2">
              취소 사유 <span className="text-red-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={200}
              rows={3}
              placeholder="예: 우천으로 인한 일괄 취소"
              className="border rounded px-3 py-2 text-sm w-full"
            />
            <div className="text-xs text-gray-400 mt-1 text-right">
              {reason.length}/200
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleReset}
              className="px-4 py-2 border rounded text-sm text-gray-700 hover:bg-gray-50"
            >
              다시 선택
            </button>
            <button
              onClick={handleDryRun}
              disabled={submitting || !reason.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? '확인 중...' : '미리보기 (Dry Run)'}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Dry Run Result + Execute */}
      {dryRunResult && !jobResult && (
        <div className="space-y-4">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="font-medium mb-4">미리보기 결과</h3>
            <div className="text-sm space-y-2">
              <div>
                <span className="text-gray-500">프로그램:</span>{' '}
                {selectedProgram?.title}
              </div>
              <div>
                <span className="text-gray-500">취소 사유:</span> {reason}
              </div>
              <div>
                <span className="text-gray-500">환불 모드:</span>{' '}
                <span className="font-mono text-xs">{dryRunResult.mode}</span>
              </div>
              <div>
                <span className="text-gray-500">대상 예약 수:</span>{' '}
                <span className="font-semibold">{dryRunResult.totalTargets}건</span>
              </div>
            </div>
          </div>

          {dryRunResult.estimatedRefunds.length > 0 && (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left">
                  <tr>
                    <th className="px-4 py-3 font-medium">예약 ID</th>
                    <th className="px-4 py-3 font-medium">결제 금액</th>
                    <th className="px-4 py-3 font-medium">예상 환불액</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {dryRunResult.estimatedRefunds
                    .slice(0, REFUND_PREVIEW_LIMIT)
                    .map((r) => (
                      <tr key={r.reservationId}>
                        <td className="px-4 py-3 font-mono text-xs">
                          {r.reservationId}
                        </td>
                        <td className="px-4 py-3">
                          {r.totalPrice.toLocaleString('ko-KR')}원
                        </td>
                        <td className="px-4 py-3">
                          {r.estimatedRefund.toLocaleString('ko-KR')}원
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
              {dryRunResult.estimatedRefunds.length > REFUND_PREVIEW_LIMIT && (
                <div className="px-4 py-3 bg-gray-50 text-xs text-gray-500">
                  외 {dryRunResult.estimatedRefunds.length - REFUND_PREVIEW_LIMIT}건 더 있음
                </div>
              )}
            </div>
          )}

          {dryRunResult.totalTargets === 0 && (
            <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 rounded p-4 text-sm">
              취소 대상 예약이 없습니다.
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={handleReset}
              className="px-4 py-2 border rounded text-sm text-gray-700 hover:bg-gray-50"
            >
              처음으로
            </button>
            <button
              onClick={() => setConfirmModalOpen(true)}
              disabled={executing || dryRunResult.totalTargets === 0}
              className="px-4 py-2 bg-red-600 text-white rounded text-sm hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {executing ? '실행 중...' : '일괄 취소 실행'}
            </button>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmModalOpen && dryRunResult && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow w-full max-w-lg p-6">
            <h3 className="text-lg font-bold mb-4">일괄 취소 실행 확인</h3>
            <div className="text-sm space-y-2 mb-4">
              <div>
                <span className="text-gray-500">프로그램:</span>{' '}
                {selectedProgram?.title}
              </div>
              <div>
                <span className="text-gray-500">대상 예약 수:</span>{' '}
                <span className="font-semibold">{dryRunResult.totalTargets}건</span>
              </div>
              <div>
                <span className="text-gray-500">환불 모드:</span>{' '}
                <span className="font-mono text-xs">{dryRunResult.mode}</span>
              </div>
            </div>
            <div className="bg-red-50 border border-red-200 text-red-800 rounded p-3 text-sm mb-6">
              이 작업은 되돌릴 수 없습니다. 대상 예약이 모두 취소되고 환불이 진행됩니다.
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmModalOpen(false)}
                className="px-4 py-2 border rounded text-sm text-gray-700 hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={handleExecute}
                className="px-4 py-2 bg-red-600 text-white rounded text-sm hover:bg-red-700"
              >
                확인, 실행합니다
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 4: Job Result */}
      {jobResult && (
        <div className="space-y-4">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="font-medium mb-4">실행 결과</h3>
            <div className="text-sm space-y-2">
              <div>
                <span className="text-gray-500">프로그램:</span>{' '}
                {jobResult.program?.title ?? selectedProgram?.title}
              </div>
              <div>
                <span className="text-gray-500">상태:</span>{' '}
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${jobResult.status === 'COMPLETED' ? 'bg-green-100 text-green-800' : jobResult.status === 'COMPLETED_WITH_ERRORS' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>
                  {jobResult.status}
                </span>
              </div>
              <div>
                <span className="text-gray-500">전체 대상:</span>{' '}
                {jobResult.totalTargets}건
              </div>
              <div>
                <span className="text-gray-500">성공:</span>{' '}
                <span className="text-green-700 font-medium">{jobResult.successCount}건</span>
              </div>
              <div>
                <span className="text-gray-500">실패:</span>{' '}
                <span className={jobResult.failedCount > 0 ? 'text-red-700 font-medium' : ''}>{jobResult.failedCount}건</span>
              </div>
              <div>
                <span className="text-gray-500">건너뜀:</span>{' '}
                {jobResult.skippedCount}건
              </div>
              <div>
                <span className="text-gray-500">Job ID:</span>{' '}
                <span className="font-mono text-xs">{jobResult.id}</span>
              </div>
            </div>
          </div>

          <div>
            <button
              onClick={handleReset}
              className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
            >
              처음으로
            </button>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
