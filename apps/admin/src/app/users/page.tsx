'use client';

import { useEffect, useState, useCallback } from 'react';
import AdminLayout from '@/components/AdminLayout';
import Pagination from '@/components/Pagination';
import { api } from '@/services/api';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  phoneNumber: string | null;
  createdAt: string;
}

interface UsersResponse {
  items: User[];
  total: number;
  page: number;
  limit: number;
}

const ROLES = ['', 'PARENT', 'INSTRUCTOR', 'ADMIN'];
const ROLE_LABELS: Record<string, string> = {
  '': '전체',
  PARENT: '학부모',
  INSTRUCTOR: '강사',
  ADMIN: '관리자',
};

export default function UsersPage() {
  const [data, setData] = useState<UsersResponse | null>(null);
  const [page, setPage] = useState(1);
  const [role, setRole] = useState('');
  const [search, setSearch] = useState('');

  const load = useCallback(() => {
    const params = new URLSearchParams({ page: String(page), limit: '20' });
    if (role) params.set('role', role);
    if (search) params.set('search', search);
    api.get<UsersResponse>(`/admin/users?${params}`).then(setData);
  }, [page, role, search]);

  useEffect(() => {
    load();
  }, [load]);

  const handleRoleChange = async (userId: string, newRole: string) => {
    if (!confirm(`역할을 ${ROLE_LABELS[newRole] || newRole}(으)로 변경하시겠습니까?`)) return;
    await api.patch(`/admin/users/${userId}/role`, { role: newRole });
    load();
  };

  return (
    <AdminLayout>
      <h2 className="text-xl font-bold mb-6">유저 관리</h2>
      <div className="mb-4 flex gap-4 items-center">
        <div className="flex gap-2">
          {ROLES.map((r) => (
            <button
              key={r}
              onClick={() => {
                setRole(r);
                setPage(1);
              }}
              className={`px-3 py-1.5 text-sm rounded border ${
                role === r ? 'bg-gray-900 text-white' : 'hover:bg-gray-100'
              }`}
            >
              {ROLE_LABELS[r]}
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder="이름 또는 이메일 검색"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (setPage(1), load())}
          className="border rounded px-3 py-1.5 text-sm w-60"
        />
      </div>
      {!data ? (
        <p className="text-gray-500">로딩 중...</p>
      ) : (
        <>
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left">
                <tr>
                  <th className="px-4 py-3 font-medium">이름</th>
                  <th className="px-4 py-3 font-medium">이메일</th>
                  <th className="px-4 py-3 font-medium">역할</th>
                  <th className="px-4 py-3 font-medium">가입일</th>
                  <th className="px-4 py-3 font-medium">역할 변경</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.items.map((u) => (
                  <tr key={u.id}>
                    <td className="px-4 py-3">{u.name}</td>
                    <td className="px-4 py-3">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 bg-gray-100 rounded text-xs font-medium">
                        {ROLE_LABELS[u.role] || u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {new Date(u.createdAt).toLocaleDateString('ko-KR')}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={u.role}
                        onChange={(e) => handleRoleChange(u.id, e.target.value)}
                        className="border rounded px-2 py-1 text-xs"
                      >
                        {ROLES.filter((r) => r).map((r) => (
                          <option key={r} value={r}>
                            {ROLE_LABELS[r]}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={data.page}
            total={data.total}
            pageSize={data.limit}
            onChange={setPage}
          />
        </>
      )}
    </AdminLayout>
  );
}
