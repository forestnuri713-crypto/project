'use client';

import { useState, useCallback } from 'react';
import { ApiError } from '@/services/api';
import type { ErrorState } from '@/types';

interface UseApiActionResult<T> {
  execute: (...args: unknown[]) => Promise<T | undefined>;
  loading: boolean;
  error: ErrorState | null;
}

/**
 * 단발성 API 호출 (승인/거절/상태변경 등)을 위한 커스텀 훅.
 * 중복 클릭 방지, 에러 처리, 성공 후 콜백을 제공합니다.
 *
 * @param action 실행할 비동기 함수
 * @param onSuccess 성공 후 실행할 콜백 (예: reload)
 */
export function useApiAction<T>(
  action: (...args: unknown[]) => Promise<T>,
  onSuccess?: () => void,
): UseApiActionResult<T> {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ErrorState | null>(null);

  const execute = useCallback(
    async (...args: unknown[]): Promise<T | undefined> => {
      if (loading) return;
      setLoading(true);
      setError(null);
      try {
        const result = await action(...args);
        onSuccess?.();
        return result;
      } catch (e) {
        if (e instanceof ApiError) {
          setError({ message: e.message, code: e.code, requestId: e.requestId });
        } else {
          setError({ message: '작업을 수행하지 못했습니다.', code: null, requestId: null });
        }
      } finally {
        setLoading(false);
      }
    },
    [action, onSuccess, loading],
  );

  return { execute, loading, error };
}
