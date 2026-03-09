'use client';

import { useEffect, useState, useCallback } from 'react';
import Pagination from '@/components/Pagination';
import StatusBadge from '@/components/StatusBadge';
import ErrorPanel from '@/components/ErrorPanel';
import { api, ApiError } from '@/services/api';
import type { JobSummary, JobItemsResponse, ErrorState } from '@/types';

const DEFAULT_PAGE_SIZE = 20;

interface JobResultProps {
  summary: JobSummary;
  programTitle?: string;
  onRetryDone: (updated: JobSummary) => void;
  onReset: () => void;
}

export default function JobResultView({
  summary,
  programTitle,
  onRetryDone,
  onReset,
}: JobResultProps) {
  const [jobItems, setJobItems] = useState<JobItemsResponse | null>(null);
  const [itemsPage, setItemsPage] = useState(1);
  const [loadingItems, setLoadingItems] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [resultFilter, setResultFilter] = useState('');
  const [error, setError] = useState<ErrorState | null>(null);

  const fetchItems = useCallback(async () => {
    setLoadingItems(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(itemsPage),
        pageSize: String(DEFAULT_PAGE_SIZE),
      });
      if (resultFilter) params.set('result', resultFilter);
      const data = await api.get<JobItemsResponse>(
        `/admin/bulk-cancel-jobs/${summary.id}/items?${params}`,
      );
      setJobItems(data);
      if (data.totalPages > 0 && itemsPage > data.totalPages) {
        setItemsPage(data.totalPages);
      }
    } catch (e) {
      if (e instanceof ApiError) {
        setError({ message: e.message, code: e.code, requestId: e.requestId });
      } else {
        setError({ message: '항목을 불러오지 못했습니다', code: null, requestId: null });
      }
    } finally {
      setLoadingItems(false);
    }
  }, [summary.id, itemsPage, resultFilter]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const handleRetry = async () => {
    setRetrying(true);
    setError(null);
    try {
      await api.post(`/admin/bulk-cancel-jobs/${summary.id}/retry`);
      const updated = await api.get<JobSummary>(`/admin/bulk-cancel-jobs/${summary.id}`);
      onRetryDone(updated);
      setItemsPage(1);
    } catch (e) {
      if (e instanceof ApiError) {
        setError({ message: e.message, code: e.code, requestId: e.requestId });
      } else {
        setError({ message: '재시도에 실패했습니다', code: null, requestId: null });
      }
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div className="space-y-4">
      {error && <ErrorPanel error={error} onRetry={fetchItems} />}

      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="font-medium mb-4">실행 결과</h3>
        <div className="text-sm space-y-2">
          <div>
            <span className="text-gray-500">프로그램:</span>{' '}
            {summary.program?.title ?? programTitle}
          </div>
          <div>
            <span className="text-gray-500">상태:</span>{' '}
            <StatusBadge status={summary.status} variant="bulkCancelJob" />
          </div>
          <div>
            <span className="text-gray-500">전체 대상:</span> {summary.totalTargets}건
          </div>
          <div>
            <span className="text-gray-500">성공:</span>{' '}
            <span className="text-green-700 font-medium">{summary.successCount}건</span>
          </div>
          <div>
            <span className="text-gray-500">실패:</span>{' '}
            <span className={summary.failedCount > 0 ? 'text-red-700 font-medium' : ''}>
              {summary.failedCount}건
            </span>
          </div>
          <div>
            <span className="text-gray-500">건너뜀:</span> {summary.skippedCount}건
          </div>
          <div>
            <span className="text-gray-500">Job ID:</span>{' '}
            <span className="font-mono text-xs">{summary.id}</span>
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        {summary.failedCount > 0 && (
          <button
            onClick={handleRetry}
            disabled={retrying}
            className="px-4 py-2 bg-yellow-600 text-white rounded text-sm hover:bg-yellow-700 disabled:opacity-50"
          >
            {retrying ? '재시도 중...' : `실패 항목 재시도 (${summary.failedCount}건)`}
          </button>
        )}
        <button
          onClick={onReset}
          className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
        >
          처음으로
        </button>
      </div>

      {/* Job Items */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <h3 className="font-medium">항목 상세</h3>
          <select
            value={resultFilter}
            onChange={(e) => { setResultFilter(e.target.value); setItemsPage(1); }}
            className="border rounded px-2 py-1 text-sm"
          >
            <option value="">전체</option>
            <option value="SUCCESS">성공</option>
            <option value="FAILED">실패</option>
            <option value="SKIPPED">건너뜀</option>
          </select>
        </div>

        {loadingItems ? (
          <p className="text-sm text-gray-500">항목 불러오는 중...</p>
        ) : !jobItems || jobItems.items.length === 0 ? (
          <p className="text-sm text-gray-500">항목이 없습니다</p>
        ) : (
          <>
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left">
                  <tr>
                    <th className="px-4 py-3 font-medium">예약 ID</th>
                    <th className="px-4 py-3 font-medium">결과</th>
                    <th className="px-4 py-3 font-medium">결제 금액</th>
                    <th className="px-4 py-3 font-medium">환불액</th>
                    <th className="px-4 py-3 font-medium">알림</th>
                    <th className="px-4 py-3 font-medium">실패 사유</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {jobItems.items.map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-3 font-mono text-xs">
                        {item.reservation?.id ?? item.reservationId}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={item.result} variant="bulkCancelItem" />
                      </td>
                      <td className="px-4 py-3">
                        {item.reservation?.participantCount != null
                          ? '-'
                          : '-'}
                      </td>
                      <td className="px-4 py-3">
                        {item.refundedAmount != null
                          ? `${item.refundedAmount.toLocaleString('ko-KR')}원`
                          : '-'}
                      </td>
                      <td className="px-4 py-3">
                        {item.notificationSent ? '발송' : '미발송'}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {item.failureCode
                          ? `${item.failureCode}: ${item.failureMessage ?? ''}`
                          : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              page={jobItems.page}
              total={jobItems.total}
              pageSize={jobItems.pageSize}
              onChange={setItemsPage}
            />
          </>
        )}
      </div>
    </div>
  );
}
