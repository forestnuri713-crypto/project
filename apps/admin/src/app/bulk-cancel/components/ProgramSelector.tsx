'use client';

import { useEffect, useState, useCallback } from 'react';
import Pagination from '@/components/Pagination';
import StatusBadge from '@/components/StatusBadge';
import { api, ApiError } from '@/services/api';
import type { AdminProgram, PaginatedResponse, ErrorState } from '@/types';

interface ProgramSelectorProps {
  onSelect: (program: AdminProgram) => void;
  onError: (error: ErrorState) => void;
}

export default function ProgramSelector({ onSelect, onError }: ProgramSelectorProps) {
  const [programs, setPrograms] = useState<PaginatedResponse<AdminProgram> | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchPrograms = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (search) params.set('search', search);
      const data = await api.get<PaginatedResponse<AdminProgram>>(`/admin/programs?${params}`);
      setPrograms(data);
    } catch (e) {
      if (e instanceof ApiError) {
        onError({ message: e.message, code: e.code, requestId: e.requestId });
      } else {
        onError({ message: '프로그램 목록을 불러오지 못했습니다', code: null, requestId: null });
      }
    } finally {
      setLoading(false);
    }
  }, [page, search, onError]);

  useEffect(() => { fetchPrograms(); }, [fetchPrograms]);

  useEffect(() => {
    const timer = setTimeout(() => { setSearch(searchInput); setPage(1); }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  return (
    <div className="space-y-4">
      <input
        type="text"
        placeholder="프로그램명 또는 강사명 검색..."
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
        className="border rounded px-3 py-2 text-sm w-full max-w-md"
      />

      {loading ? (
        <p className="text-sm text-gray-500">프로그램 목록 불러오는 중...</p>
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
                    <td className="px-4 py-3">{p.instructor?.name ?? '-'}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={p.approvalStatus} variant="approval" />
                    </td>
                    <td className="px-4 py-3">
                      {new Date(p.createdAt).toLocaleDateString('ko-KR')}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => onSelect(p)}
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
            pageSize={programs.limit ?? 20}
            onChange={setPage}
          />
        </>
      )}
    </div>
  );
}
