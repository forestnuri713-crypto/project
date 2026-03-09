'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import AdminLayout from '@/components/AdminLayout';
import ErrorPanel from '@/components/ErrorPanel';
import Modal from '@/components/Modal';
import { api, ApiError } from '@/services/api';
import type { AdminProgram, DryRunResult, CreatedJob, JobSummary, ErrorState } from '@/types';

import ProgramSelector from './components/ProgramSelector';
import DryRunPreview from './components/DryRunPreview';
import JobResultView from './components/JobResult';

export default function BulkCancelClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initializedFromUrl = useRef(false);

  // State
  const [selectedProgram, setSelectedProgram] = useState<AdminProgram | null>(null);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [dryRunResult, setDryRunResult] = useState<DryRunResult | null>(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [jobResult, setJobResult] = useState<JobSummary | null>(null);
  const [error, setError] = useState<ErrorState | null>(null);

  // URL → state restore (on mount)
  useEffect(() => {
    if (initializedFromUrl.current) return;
    initializedFromUrl.current = true;

    const urlJobId = searchParams.get('jobId');
    if (!urlJobId) return;

    api.get<JobSummary>(`/admin/bulk-cancel-jobs/${urlJobId}`)
      .then((summary) => { setJobResult(summary); setError(null); })
      .catch((e) => {
        if (e instanceof ApiError) {
          setError({ message: e.message, code: e.code, requestId: e.requestId });
        } else {
          setError({ message: '작업을 불러오지 못했습니다', code: null, requestId: null });
        }
      });
  }, [searchParams]);

  // State → URL sync
  useEffect(() => {
    if (!jobResult) return;
    const params = new URLSearchParams();
    params.set('jobId', jobResult.id);
    router.replace(`/bulk-cancel?${params}`, { scroll: false });
  }, [jobResult, router]);

  // Dry run
  const handleDryRun = useCallback(async () => {
    if (!selectedProgram || !reason.trim()) {
      setError({ message: '취소 사유를 입력해 주세요', code: null, requestId: null });
      return;
    }
    setSubmitting(true);
    setError(null);
    setDryRunResult(null);
    try {
      const result = await api.post<DryRunResult>(
        `/admin/sessions/${selectedProgram.id}/bulk-cancel`,
        { reason: reason.trim(), dryRun: true },
      );
      setDryRunResult(result);
    } catch (e) {
      if (e instanceof ApiError) {
        setError({ message: e.message, code: e.code, requestId: e.requestId });
      } else {
        setError({ message: '미리보기에 실패했습니다', code: null, requestId: null });
      }
    } finally {
      setSubmitting(false);
    }
  }, [selectedProgram, reason]);

  // Execute
  const handleExecute = useCallback(async () => {
    if (!selectedProgram || !reason.trim()) return;
    setExecuting(true);
    setError(null);
    setConfirmModalOpen(false);
    try {
      const created = await api.post<CreatedJob>(
        `/admin/sessions/${selectedProgram.id}/bulk-cancel`,
        { reason: reason.trim() },
      );
      await api.post(`/admin/bulk-cancel-jobs/${created.id}/start`);
      const summary = await api.get<JobSummary>(`/admin/bulk-cancel-jobs/${created.id}`);
      setJobResult(summary);
    } catch (e) {
      if (e instanceof ApiError) {
        setError({ message: e.message, code: e.code, requestId: e.requestId });
      } else {
        setError({ message: '실행에 실패했습니다', code: null, requestId: null });
      }
    } finally {
      setExecuting(false);
    }
  }, [selectedProgram, reason]);

  // Reset
  const handleReset = () => {
    setSelectedProgram(null);
    setReason('');
    setDryRunResult(null);
    setJobResult(null);
    setConfirmModalOpen(false);
    setError(null);
    router.replace('/bulk-cancel', { scroll: false });
  };

  return (
    <AdminLayout>
      <h2 className="text-xl font-bold mb-6">일괄 취소</h2>

      {error && <ErrorPanel error={error} onRetry={undefined} />}

      {/* Step 1: Program Selection */}
      {!selectedProgram && !jobResult && (
        <ProgramSelector
          onSelect={(p) => { setSelectedProgram(p); setError(null); setDryRunResult(null); }}
          onError={setError}
        />
      )}

      {/* Step 2: Reason + Dry Run */}
      {selectedProgram && !dryRunResult && !jobResult && (
        <div className="space-y-4">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="font-medium mb-4">선택된 프로그램</h3>
            <div className="text-sm space-y-1">
              <div><span className="text-gray-500">프로그램:</span> {selectedProgram.title}</div>
              <div><span className="text-gray-500">강사:</span> {selectedProgram.instructor?.name ?? '-'}</div>
              <div><span className="text-gray-500">ID:</span> <span className="font-mono text-xs">{selectedProgram.id}</span></div>
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
            <div className="text-xs text-gray-400 mt-1 text-right">{reason.length}/200</div>
          </div>

          <div className="flex gap-2">
            <button onClick={handleReset} className="px-4 py-2 border rounded text-sm text-gray-700 hover:bg-gray-50">
              다시 선택
            </button>
            <button
              onClick={handleDryRun}
              disabled={submitting || !reason.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? '확인 중...' : '미리보기 (Dry Run)'}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Dry Run Result */}
      {dryRunResult && !jobResult && selectedProgram && (
        <DryRunPreview
          program={selectedProgram}
          reason={reason}
          result={dryRunResult}
          executing={executing}
          onExecute={() => setConfirmModalOpen(true)}
          onReset={handleReset}
        />
      )}

      {/* Confirmation Modal */}
      <Modal
        open={confirmModalOpen && !!dryRunResult}
        onClose={() => setConfirmModalOpen(false)}
        title="일괄 취소 실행 확인"
      >
        <div className="text-sm space-y-2 mb-4">
          <div><span className="text-gray-500">프로그램:</span> {selectedProgram?.title}</div>
          <div><span className="text-gray-500">대상 예약 수:</span> <span className="font-semibold">{dryRunResult?.totalTargets}건</span></div>
          <div><span className="text-gray-500">환불 모드:</span> <span className="font-mono text-xs">{dryRunResult?.mode}</span></div>
        </div>
        <div className="bg-red-50 border border-red-200 text-red-800 rounded p-3 text-sm mb-6">
          이 작업은 되돌릴 수 없습니다. 대상 예약이 모두 취소되고 환불이 진행됩니다.
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={() => setConfirmModalOpen(false)} className="px-4 py-2 border rounded text-sm text-gray-700 hover:bg-gray-50">
            취소
          </button>
          <button onClick={handleExecute} className="px-4 py-2 bg-red-600 text-white rounded text-sm hover:bg-red-700">
            확인, 실행합니다
          </button>
        </div>
      </Modal>

      {/* Step 4: Job Result */}
      {jobResult && (
        <JobResultView
          summary={jobResult}
          programTitle={selectedProgram?.title}
          onRetryDone={setJobResult}
          onReset={handleReset}
        />
      )}
    </AdminLayout>
  );
}
