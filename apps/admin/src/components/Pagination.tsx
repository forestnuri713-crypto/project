'use client';

interface PaginationProps {
  page: number;
  total: number;
  pageSize: number;
  onChange: (page: number) => void;
}

export default function Pagination({ page, total, pageSize, onChange }: PaginationProps) {
  const totalPages = Math.ceil(total / pageSize);
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between mt-4">
      <p className="text-sm text-gray-600">
        총 {total}건 (페이지 {page}/{totalPages})
      </p>
      <div className="flex gap-1">
        <button
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
          className="px-3 py-1 text-sm border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
        >
          이전
        </button>
        {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
          const start = Math.max(1, Math.min(page - 2, totalPages - 4));
          const p = start + i;
          if (p > totalPages) return null;
          return (
            <button
              key={p}
              onClick={() => onChange(p)}
              className={`px-3 py-1 text-sm border rounded ${
                p === page ? 'bg-gray-900 text-white' : 'hover:bg-gray-100'
              }`}
            >
              {p}
            </button>
          );
        })}
        <button
          disabled={page >= totalPages}
          onClick={() => onChange(page + 1)}
          className="px-3 py-1 text-sm border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
        >
          다음
        </button>
      </div>
    </div>
  );
}
