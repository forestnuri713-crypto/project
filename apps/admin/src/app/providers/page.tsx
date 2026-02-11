'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import AdminLayout from '@/components/AdminLayout';
import Pagination from '@/components/Pagination';
import { api } from '@/services/api';

interface Provider {
  id: string;
  name: string;
  regionTags: string[] | null;
  createdAt: string;
  profile: { isPublished: boolean } | null;
}

interface ProvidersResponse {
  items: Provider[];
  total: number;
  page: number;
  pageSize: number;
}

export default function ProvidersPage() {
  const [data, setData] = useState<ProvidersResponse | null>(null);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formTags, setFormTags] = useState('');

  const load = useCallback(() => {
    const params = new URLSearchParams({ page: String(page), pageSize: '20' });
    if (query) params.set('query', query);
    api.get<ProvidersResponse>(`/admin/providers?${params}`).then(setData);
  }, [page, query]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async () => {
    if (!formName.trim()) return;
    await api.post('/admin/providers', {
      name: formName,
      regionTags: formTags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
    });
    setShowCreate(false);
    setFormName('');
    setFormTags('');
    load();
  };

  const handleUpdate = async () => {
    if (!editId || !formName.trim()) return;
    await api.patch(`/admin/providers/${editId}`, {
      name: formName,
      regionTags: formTags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
    });
    setEditId(null);
    setFormName('');
    setFormTags('');
    load();
  };

  const startEdit = (p: Provider) => {
    setEditId(p.id);
    setFormName(p.name);
    setFormTags((p.regionTags || []).join(', '));
    setShowCreate(false);
  };

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold">Provider 관리</h2>
        <button
          onClick={() => {
            setShowCreate(true);
            setEditId(null);
            setFormName('');
            setFormTags('');
          }}
          className="px-4 py-2 bg-gray-900 text-white text-sm rounded hover:bg-gray-800"
        >
          새 Provider
        </button>
      </div>

      {(showCreate || editId) && (
        <div className="bg-white rounded-lg shadow p-4 mb-4">
          <h3 className="font-medium mb-3">
            {showCreate ? 'Provider 생성' : 'Provider 수정'}
          </h3>
          <div className="flex gap-3 items-end">
            <div>
              <label className="block text-xs text-gray-500 mb-1">업체명</label>
              <input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                className="border rounded px-3 py-1.5 text-sm w-48"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                지역 태그 (쉼표 구분)
              </label>
              <input
                value={formTags}
                onChange={(e) => setFormTags(e.target.value)}
                className="border rounded px-3 py-1.5 text-sm w-60"
                placeholder="서울, 경기"
              />
            </div>
            <button
              onClick={showCreate ? handleCreate : handleUpdate}
              className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
            >
              {showCreate ? '생성' : '저장'}
            </button>
            <button
              onClick={() => {
                setShowCreate(false);
                setEditId(null);
              }}
              className="px-4 py-1.5 border text-sm rounded hover:bg-gray-100"
            >
              취소
            </button>
          </div>
        </div>
      )}

      <div className="mb-4">
        <input
          type="text"
          placeholder="업체명 검색"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (setPage(1), load())}
          className="border rounded px-3 py-1.5 text-sm w-60"
        />
      </div>

      {!data ? (
        <p className="text-gray-500">로딩 중...</p>
      ) : data.items.length === 0 ? (
        <p className="text-gray-500">등록된 Provider가 없습니다</p>
      ) : (
        <>
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left">
                <tr>
                  <th className="px-4 py-3 font-medium">업체명</th>
                  <th className="px-4 py-3 font-medium">지역</th>
                  <th className="px-4 py-3 font-medium">미니홈</th>
                  <th className="px-4 py-3 font-medium">등록일</th>
                  <th className="px-4 py-3 font-medium">작업</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.items.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-3 font-medium">{p.name}</td>
                    <td className="px-4 py-3">
                      {(p.regionTags || []).map((t) => (
                        <span
                          key={t}
                          className="inline-block mr-1 px-2 py-0.5 bg-gray-100 rounded text-xs"
                        >
                          {t}
                        </span>
                      ))}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium ${
                          p.profile?.isPublished
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {p.profile?.isPublished ? '게시중' : '미게시'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {new Date(p.createdAt).toLocaleDateString('ko-KR')}
                    </td>
                    <td className="px-4 py-3 space-x-2">
                      <button
                        onClick={() => startEdit(p)}
                        className="px-3 py-1 border rounded text-xs hover:bg-gray-100"
                      >
                        수정
                      </button>
                      <Link
                        href={`/providers/${p.id}/profile`}
                        className="px-3 py-1 bg-indigo-600 text-white rounded text-xs hover:bg-indigo-700 inline-block"
                      >
                        미니홈 편집
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={data.page}
            total={data.total}
            pageSize={data.pageSize}
            onChange={setPage}
          />
        </>
      )}
    </AdminLayout>
  );
}
