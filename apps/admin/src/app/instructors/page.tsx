"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import AdminLayout from "@/components/AdminLayout";
import Pagination from "@/components/Pagination";
import { api, ApiError } from "@/services/api";

type InstructorStatus = "APPLIED" | "APPROVED" | "REJECTED";

interface Instructor {
  id: string;
  email: string;
  name: string;
  role: "INSTRUCTOR";
  phoneNumber: string | null;
  profileImageUrl: string | null;
  instructorStatus: InstructorStatus;
  instructorStatusReason: string | null;
  certifications: unknown;
  createdAt: string;
}

interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

const STATUS_LABELS: Record<InstructorStatus, string> = {
  APPLIED: "신청",
  APPROVED: "승인",
  REJECTED: "거절",
};

const STATUS_BADGE: Record<InstructorStatus, string> = {
  APPLIED: "bg-yellow-100 text-yellow-800",
  APPROVED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-800",
};

function certsCount(certs: unknown): number {
  if (Array.isArray(certs)) return certs.length;
  if (certs && typeof certs === "object") {
    // sometimes stored as JSON object; count values conservatively
    const v = Object.values(certs as Record<string, unknown>);
    return Array.isArray(v) ? v.length : 0;
  }
  return 0;
}

export default function InstructorsPage() {
  const [tab, setTab] = useState<"ALL" | InstructorStatus>("APPLIED");
  const [search, setSearch] = useState<string>("");
  const [page, setPage] = useState<number>(1);

  const [data, setData] = useState<Paginated<Instructor> | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<{ message: string; requestId: string | null } | null>(null);

  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", "20");

    if (tab !== "ALL") params.set("instructorStatus", tab);
    if (search.trim().length > 0) params.set("search", search.trim());

    return params.toString();
  }, [page, tab, search]);

  const fetchList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<Paginated<Instructor>>(`/admin/instructors?${queryString}`);
      setData(res);
    } catch (e) {
      if (e instanceof ApiError) {
        setError({ message: e.message, requestId: ('requestId' in e ? (e as any).requestId ?? null : null) });
      } else {
        setError({ message: "Failed to load instructors", requestId: null });
      }
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [queryString]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  // reset page when tab changes
  useEffect(() => {
    setPage(1);
  }, [tab]);

  const onSearchChange = (v: string) => {
    setSearch(v);
    setPage(1);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      // trigger refetch by state change already; but fetch is tied to queryString
      // so no-op here is fine.
    }, 300);
  };

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold">강사 관리</h2>
      </div>

      <div className="mb-4 flex gap-2 items-center flex-wrap">
        <div className="flex gap-2">
          {(["ALL", "APPLIED", "APPROVED", "REJECTED"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setTab(k)}
              className={`px-3 py-1.5 rounded text-sm border ${
                tab === k ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-900 border-gray-200"
              }`}
            >
              {k === "ALL" ? "전체" : STATUS_LABELS[k]}
            </button>
          ))}
        </div>

        <input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="이름/이메일 검색"
          className="border rounded px-3 py-1.5 text-sm w-64"
        />

        <button
          type="button"
          onClick={fetchList}
          className="px-3 py-1.5 rounded text-sm bg-gray-100 hover:bg-gray-200"
        >
          새로고침
        </button>
      </div>

      {loading ? (
        <div className="text-sm text-gray-600">로딩 중...</div>
      ) : error ? (
        <div className="text-sm text-red-600">
          {error.message}
          {error.requestId ? (
            <span className="ml-2 text-gray-600">(requestId: {error.requestId})</span>
          ) : null}
        </div>
      ) : !data || data.items.length === 0 ? (
        <div className="text-sm text-gray-600">결과가 없습니다.</div>
      ) : (
        <>
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-700">
                <tr>
                  <th className="px-4 py-3 font-medium text-left">이름</th>
                  <th className="px-4 py-3 font-medium text-left">이메일</th>
                  <th className="px-4 py-3 font-medium text-left">전화번호</th>
                  <th className="px-4 py-3 font-medium text-left">상태</th>
                  <th className="px-4 py-3 font-medium text-left">자격증</th>
                  <th className="px-4 py-3 font-medium text-left">등록일</th>
                  <th className="px-4 py-3 font-medium text-left">액션</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((i) => (
                  <tr key={i.id} className="border-t">
                    <td className="px-4 py-3">{i.name}</td>
                    <td className="px-4 py-3">{i.email}</td>
                    <td className="px-4 py-3">{i.phoneNumber || "-"}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_BADGE[i.instructorStatus]}`}>
                        {STATUS_LABELS[i.instructorStatus]}
                      </span>
                    </td>
                    <td className="px-4 py-3">{certsCount(i.certifications)}</td>
                    <td className="px-4 py-3">{new Date(i.createdAt).toISOString().slice(0, 10)}</td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/instructors/${i.id}`}
                        className="px-3 py-1 bg-gray-900 text-white rounded text-xs hover:bg-gray-800"
                      >
                        상세
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4">
            <Pagination page={data.page} total={data.total} pageSize={data.limit} onChange={setPage} />
          </div>
        </>
      )}
    </AdminLayout>
  );
}


