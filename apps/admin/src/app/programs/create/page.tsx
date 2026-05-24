'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import AdminLayout from '@/components/AdminLayout';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import type { ProgramStatus } from '@/types';

interface FormState {
  title: string;
  subtitle: string;
  description: string;
  thumbnail_url: string;
  location: string;
  address: string;
  start_date: string;
  end_date: string;
  capacity: string;
  status: ProgramStatus;
  is_featured: boolean;
}

const INITIAL: FormState = {
  title: '',
  subtitle: '',
  description: '',
  thumbnail_url: '',
  location: '',
  address: '',
  start_date: '',
  end_date: '',
  capacity: '',
  status: 'draft',
  is_featured: false,
};

export default function ProgramCreatePage() {
  const router = useRouter();
  const { user } = useAuth();
  const [form, setForm] = useState<FormState>(INITIAL);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (field: keyof FormState, value: string | boolean) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!form.title.trim()) {
      setError('제목을 입력해주세요');
      return;
    }
    const capacity = parseInt(form.capacity);
    if (isNaN(capacity) || capacity < 1) {
      setError('정원을 올바르게 입력해주세요');
      return;
    }

    setLoading(true);
    const { error: err } = await supabase.from('programs').insert({
      title: form.title.trim(),
      subtitle: form.subtitle.trim() || null,
      description: form.description.trim() || null,
      thumbnail_url: form.thumbnail_url.trim() || null,
      location: form.location.trim() || null,
      address: form.address.trim() || null,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      capacity,
      current_reservation_count: 0,
      status: form.status,
      is_featured: form.is_featured,
      created_by: user?.id,
    });

    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }
    router.push('/programs');
  };

  return (
    <AdminLayout>
      <div className="max-w-2xl">
        <div className="flex items-center gap-2 mb-6">
          <button
            onClick={() => router.back()}
            className="text-gray-500 hover:text-gray-700 text-sm"
          >
            ← 뒤로
          </button>
          <h2 className="text-xl font-bold">프로그램 등록</h2>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">제목 *</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              required
              className="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">부제목</label>
            <input
              type="text"
              value={form.subtitle}
              onChange={(e) => set('subtitle', e.target.value)}
              className="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">설명</label>
            <textarea
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">장소</label>
              <input
                type="text"
                value={form.location}
                onChange={(e) => set('location', e.target.value)}
                className="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">주소</label>
              <input
                type="text"
                value={form.address}
                onChange={(e) => set('address', e.target.value)}
                className="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">시작일</label>
              <input
                type="date"
                value={form.start_date}
                onChange={(e) => set('start_date', e.target.value)}
                className="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">종료일</label>
              <input
                type="date"
                value={form.end_date}
                onChange={(e) => set('end_date', e.target.value)}
                className="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">정원 *</label>
              <input
                type="number"
                min="1"
                value={form.capacity}
                onChange={(e) => set('capacity', e.target.value)}
                required
                className="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">상태</label>
              <select
                value={form.status}
                onChange={(e) => set('status', e.target.value as ProgramStatus)}
                className="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="draft">작성 중</option>
                <option value="published">공개</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">썸네일 URL</label>
            <input
              type="url"
              value={form.thumbnail_url}
              onChange={(e) => set('thumbnail_url', e.target.value)}
              placeholder="https://..."
              className="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_featured"
              checked={form.is_featured}
              onChange={(e) => set('is_featured', e.target.checked)}
              className="w-4 h-4"
            />
            <label htmlFor="is_featured" className="text-sm text-gray-700">
              추천 프로그램
            </label>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:bg-gray-300"
            >
              {loading ? '저장 중...' : '프로그램 등록'}
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              className="px-6 py-2 border text-sm rounded hover:bg-gray-100"
            >
              취소
            </button>
          </div>
        </form>
      </div>
    </AdminLayout>
  );
}
