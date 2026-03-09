'use client';

import type { AdminProgram, DryRunResult } from '@/types';

const REFUND_PREVIEW_LIMIT = 20;

interface DryRunPreviewProps {
  program: AdminProgram;
  reason: string;
  result: DryRunResult;
  executing: boolean;
  onExecute: () => void;
  onReset: () => void;
}

export default function DryRunPreview({
  program,
  reason,
  result,
  executing,
  onExecute,
  onReset,
}: DryRunPreviewProps) {
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="font-medium mb-4">미리보기 결과</h3>
        <div className="text-sm space-y-2">
          <div>
            <span className="text-gray-500">프로그램:</span> {program.title}
          </div>
          <div>
            <span className="text-gray-500">취소 사유:</span> {reason}
          </div>
          <div>
            <span className="text-gray-500">환불 모드:</span>{' '}
            <span className="font-mono text-xs">{result.mode}</span>
          </div>
          <div>
            <span className="text-gray-500">대상 예약 수:</span>{' '}
            <span className="font-semibold">{result.totalTargets}건</span>
          </div>
        </div>
      </div>

      {result.estimatedRefunds.length > 0 && (
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
              {result.estimatedRefunds.slice(0, REFUND_PREVIEW_LIMIT).map((r) => (
                <tr key={r.reservationId}>
                  <td className="px-4 py-3 font-mono text-xs">{r.reservationId}</td>
                  <td className="px-4 py-3">{r.totalPrice.toLocaleString('ko-KR')}원</td>
                  <td className="px-4 py-3">{r.estimatedRefund.toLocaleString('ko-KR')}원</td>
                </tr>
              ))}
            </tbody>
          </table>
          {result.estimatedRefunds.length > REFUND_PREVIEW_LIMIT && (
            <div className="px-4 py-3 bg-gray-50 text-xs text-gray-500">
              외 {result.estimatedRefunds.length - REFUND_PREVIEW_LIMIT}건 더 있음
            </div>
          )}
        </div>
      )}

      {result.totalTargets === 0 && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 rounded p-4 text-sm">
          취소 대상 예약이 없습니다.
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={onReset}
          className="px-4 py-2 border rounded text-sm text-gray-700 hover:bg-gray-50"
        >
          처음으로
        </button>
        <button
          onClick={onExecute}
          disabled={executing || result.totalTargets === 0}
          className="px-4 py-2 bg-red-600 text-white rounded text-sm hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {executing ? '실행 중...' : '일괄 취소 실행'}
        </button>
      </div>
    </div>
  );
}
