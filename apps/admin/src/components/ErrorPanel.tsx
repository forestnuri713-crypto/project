'use client';

import type { ErrorState } from '@/types';

interface ErrorPanelProps {
  error: ErrorState;
  onRetry?: () => void;
}

export default function ErrorPanel({ error, onRetry }: ErrorPanelProps) {
  return (
    <div className="bg-red-50 border border-red-200 text-red-800 rounded p-4 text-sm mb-6">
      <div className="font-medium">오류</div>
      <div>{error.message}</div>
      {error.code && <div className="text-xs mt-1">code: {error.code}</div>}
      {error.requestId && <div className="text-xs mt-1">requestId: {error.requestId}</div>}
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-3 px-3 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700"
        >
          다시 시도
        </button>
      )}
    </div>
  );
}
