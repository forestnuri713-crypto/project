'use client';

import { useState, useCallback, useEffect } from 'react';
import { api, ApiError } from '@/services/api';
import type { PaginatedResponse, ErrorState } from '@/types';

interface UseListDataOptions {
  /** API 경로 (예: '/admin/users') */
  endpoint: string;
  /** 페이지 크기 (기본 20) */
  pageSize?: number;
  /** 백엔드가 pageSize 파라미터명을 사용하는 경우 true (기본 limit) */
  pageSizeParam?: 'limit' | 'pageSize';
  /** 추가 필터 (빈 문자열 값은 자동 제외) */
  filters?: Record<string, string>;
}

interface UseListDataResult<T> {
  data: PaginatedResponse<T> | null;
  loading: boolean;
  error: ErrorState | null;
  page: number;
  setPage: (page: number) => void;
  reload: () => void;
}

export function useListData<T>({
  endpoint,
  pageSize = 20,
  pageSizeParam = 'limit',
  filters = {},
}: UseListDataOptions): UseListDataResult<T> {
  const [data, setData] = useState<PaginatedResponse<T> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ErrorState | null>(null);
  const [page, setPage] = useState(1);

  // JSON-stringify filters for stable dependency
  const filtersKey = JSON.stringify(filters);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        [pageSizeParam]: String(pageSize),
      });
      const parsed: Record<string, string> = JSON.parse(filtersKey);
      for (const [k, v] of Object.entries(parsed)) {
        if (v) params.set(k, v);
      }
      const res = await api.get<PaginatedResponse<T>>(`${endpoint}?${params}`);
      setData(res);
    } catch (e) {
      if (e instanceof ApiError) {
        setError({ message: e.message, code: e.code, requestId: e.requestId });
      } else {
        setError({ message: '데이터를 불러오지 못했습니다.', code: null, requestId: null });
      }
    } finally {
      setLoading(false);
    }
  }, [endpoint, page, pageSize, pageSizeParam, filtersKey]);

  useEffect(() => {
    load();
  }, [load]);

  // 필터 변경 시 1페이지로 리셋
  useEffect(() => {
    setPage(1);
  }, [filtersKey]);

  return { data, loading, error, page, setPage, reload: load };
}
