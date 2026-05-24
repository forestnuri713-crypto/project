'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AdminLayout from '@/components/AdminLayout';
import { supabase } from '@/lib/supabase';
import type { Program, ProgramStatus } from '@/types';
import { PROGRAM_STATUS_LABELS } from '@/constants';

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

export default function ProgramEditPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [form, setForm] = useState<FormState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [isArchived, setIsArchived] = useState(false);

  useEffect(() => {
    supabase
      .from('programs')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single()
      .then(({ data, error: err }) => {
        if (err || !data) {
          router.replace('/programs');
          return;
        }
        const p = data as Program;
        if (p.status === 'archived') setIsArchived(true);
        setForm({
          title: p.title,
          subtitle: p.subtitle ?? '',
          description: p.description ?? '',
          thumbnail_url: p.thumbnail_url ?? '',
          location: p.location ?? '',
          address: p.address ?? '',
          start_date: p.start_date ?? '',
          end_date: p.end_date ?? '',
          capacity: String(p.capacity),
          status: p.status,
          is_featured: p.is_featured,
        });
        setLoading(false);
      });
  }, [id, router]);

  const set = (field: keyof FormState, value: string | boolean) =>
    setForm((prev) => (prev ? { ...prev, [field]: value } : prev));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form || isArchived) return;
    setError('');

    const capacity = parseInt(form.capacity);
    if (isNaN(capacity) || capacity < 1) {
      setError('정원을 올바르게 입력해주세요');
      return;
    }

    setSaving(true);
    const { error: err } = await supabase
      .from('programs')
      .update({
        title: form.title.trim(),
        subtitle: form.subtitle.trim() || null,
        description: form.description.trim() || null,
        thumbnail_url: form.thumbnail_url.trim() || null,
        location: form.location.trim() || null,
        address: form.address.trim() || null,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        capacity,
        status: form.status,
        is_featured: form.is_featured,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (err) {
      setError(err.message);
      setSaving(false);
      return;
    }
    router.push(`/programs/${id}`);
  };

  if (loading) {
    return (
      <AdminLayout>
        <p className="text-gray-500">로딩 중...</p>
      </AdminLayout>
    );
  }
  if (!form) return null;

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
          <h2 className="text-xl font-bold">프로그램 수정</h2>
        </div>

        {isArchived && (
          <div className="mb-4 p-3 bg-yellow-50 text-yellow-800 text-sm rounded">
            종료된 프로그램은 수정할 수 없습니다
          </div>
        )}
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
              disabled={isArchived}
              className="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">부제목</label>
            <input
              type="text"
              value={form.subtitle}
              onChange={(e) => set('subtitle', e.target.value)}
              disabled={isArchived}
              className="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">설명</label>
            <textarea
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              rows={4}
              disabled={isArchived}
              className="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-100"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">장소</label>
              <input
                type="text"
                value={form.location}
                onChange={(e) => set('location', e.target.value)}
                disabled={isArchived}
                className="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">주소</label>
              <input
                type="text"
                value={form.address}
                onChange={(e) => set('address', e.target.value)}
                disabled={isArchived}
                className="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-100"
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
                disabled={isArchived}
                className="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">종료일</label>
              <input
                type="date"
                value={form.end_date}
                onChange={(e) => set('end_date', e.target.value)}
                disabled={isArchived}
                className="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-100"
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
                disabled={isArchived}
                className="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">상태</label>
              <select
                value={form.status}
                onChange={(e) => set('status', e.target.value as ProgramStatus)}
                disabled={isArchived}
                className="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-100"
              >
                {(['draft', 'published', 'closed', 'archived'] as ProgramStatus[]).map((s) => (
                  <option key={s} value={s}>
                    {PROGRAM_STATUS_LABELS[s]}
                  </option>
                ))}
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
              disabled={isArchived}
              className="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-100"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_featured"
              checked={form.is_featured}
              onChange={(e) => set('is_featured', e.target.checked)}
              disabled={isArchived}
              className="w-4 h-4"
            />
            <label htmlFor="is_featured" className="text-sm text-gray-700">
              추천 프로그램
            </label>
          </div>

          {!isArchived && (
            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:bg-gray-300"
              >
                {saving ? '저장 중...' : '저장'}
              </button>
              <button
                type="button"
                onClick={() => router.back()}
                className="px-6 py-2 border text-sm rounded hover:bg-gray-100"
              >
                취소
              </button>
            </div>
          )}
        </form>
      </div>
    </AdminLayout>
  );
}
