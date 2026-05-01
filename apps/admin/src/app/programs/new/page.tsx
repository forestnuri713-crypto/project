'use client';

import { useEffect, useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import AdminLayout from '@/components/AdminLayout';
import { api, ApiError } from '@/services/api';

interface Instructor {
  id: string;
  name: string;
  email: string;
  instructorStatus: 'APPLIED' | 'APPROVED' | 'REJECTED';
}

interface InstructorsResponse {
  items: Instructor[];
  total: number;
  page: number;
  limit: number;
}

interface FormState {
  instructorId: string;
  title: string;
  description: string;
  keywords: string[];
  location: string;
  price: string;
  maxCapacity: string;
  minAge: string;
  scheduleAt: string;
  bookingDeadlineDays: string;
  isB2b: boolean;
  safetyGuide: string;
  insuranceCovered: boolean;
  coverImageKey: string | null;
  galleryImageKeys: string[];
}

const INITIAL: FormState = {
  instructorId: '',
  title: '',
  description: '',
  keywords: [],
  location: '',
  price: '',
  maxCapacity: '',
  minAge: '',
  scheduleAt: '',
  bookingDeadlineDays: '',
  isB2b: false,
  safetyGuide: '',
  insuranceCovered: false,
  coverImageKey: null,
  galleryImageKeys: [],
};

interface UploadUrlResponse {
  uploads: { key: string; uploadUrl: string }[];
}

async function uploadFiles(files: File[]): Promise<string[]> {
  const { uploads } = await api.post<UploadUrlResponse>('/admin/programs/upload-url', {
    files: files.map((f) => ({ filename: f.name, contentType: f.type || 'application/octet-stream' })),
  });
  await Promise.all(
    uploads.map((u, i) =>
      fetch(u.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': files[i].type || 'application/octet-stream' },
        body: files[i],
      }).then((res) => {
        if (!res.ok) throw new Error(`이미지 업로드 실패: ${files[i].name}`);
      }),
    ),
  );
  return uploads.map((u) => u.key);
}

const KEYWORD_SUGGESTIONS = [
  '숲체험', '자연관찰', '곤충관찰', '식물관찰', '나무탐구', '새 관찰',
  '등산/하이킹', '캠핑', '공예/만들기', '안전교육', '환경교육', '생태교육',
  '야외놀이', '미술/그림', '음악/노래', '스토리텔링', '협동활동', '신체활동',
  '가족참여', '계절체험', '체험학습', '농촌체험',
];

export default function ProgramNewPage() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(INITIAL);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<InstructorsResponse>('/admin/instructors?status=APPROVED&page=1&limit=100')
      .then((res) => setInstructors(res.items))
      .catch(() => setInstructors([]));
  }, []);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const toggleKeyword = (kw: string) => {
    setForm((prev) => ({
      ...prev,
      keywords: prev.keywords.includes(kw)
        ? prev.keywords.filter((k) => k !== kw)
        : [...prev.keywords, kw],
    }));
  };

  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingGallery, setUploadingGallery] = useState(false);

  const handleCoverChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploadingCover(true);
    try {
      const [key] = await uploadFiles([file]);
      update('coverImageKey', key);
    } catch (err) {
      setError(err instanceof Error ? err.message : '대표 이미지 업로드 실패');
    } finally {
      setUploadingCover(false);
      e.target.value = '';
    }
  };

  const handleGalleryChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setError(null);
    setUploadingGallery(true);
    try {
      const keys = await uploadFiles(files);
      setForm((prev) => ({ ...prev, galleryImageKeys: [...prev.galleryImageKeys, ...keys] }));
    } catch (err) {
      setError(err instanceof Error ? err.message : '이미지 업로드 실패');
    } finally {
      setUploadingGallery(false);
      e.target.value = '';
    }
  };

  const removeGalleryKey = (key: string) => {
    setForm((prev) => ({
      ...prev,
      galleryImageKeys: prev.galleryImageKeys.filter((k) => k !== key),
    }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!form.instructorId) {
      setError('강사를 선택해주세요');
      return;
    }

    const payload = {
      instructorId: form.instructorId,
      title: form.title.trim(),
      description: form.description.trim(),
      keywords: form.keywords,
      location: form.location.trim(),
      price: parseInt(form.price, 10),
      maxCapacity: parseInt(form.maxCapacity, 10),
      minAge: parseInt(form.minAge, 10),
      scheduleAt: new Date(form.scheduleAt).toISOString(),
      isB2b: form.isB2b,
      insuranceCovered: form.insuranceCovered,
      ...(form.safetyGuide.trim() ? { safetyGuide: form.safetyGuide.trim() } : {}),
      ...(form.coverImageKey ? { coverImageKey: form.coverImageKey } : {}),
      ...(form.galleryImageKeys.length > 0 ? { galleryImageKeys: form.galleryImageKeys } : {}),
      ...(form.bookingDeadlineDays
        ? { bookingDeadlineDays: parseInt(form.bookingDeadlineDays, 10) }
        : {}),
    };

    setSubmitting(true);
    try {
      await api.post('/admin/programs', payload);
      alert('프로그램이 등록되었습니다');
      router.push('/programs/pending');
    } catch (err) {
      const message = err instanceof ApiError ? err.message : '등록 중 오류가 발생했습니다';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AdminLayout>
      <h2 className="text-xl font-bold mb-6">프로그램 등록</h2>

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 max-w-3xl space-y-4">
        <Field label="강사" required>
          <select
            value={form.instructorId}
            onChange={(e) => update('instructorId', e.target.value)}
            className="w-full border rounded px-3 py-2 text-sm"
            required
          >
            <option value="">강사를 선택하세요</option>
            {instructors.map((it) => (
              <option key={it.id} value={it.id}>
                {it.name} ({it.email})
              </option>
            ))}
          </select>
        </Field>

        <Field label="프로그램 이름" required>
          <input
            type="text"
            value={form.title}
            onChange={(e) => update('title', e.target.value)}
            className="w-full border rounded px-3 py-2 text-sm"
            required
          />
        </Field>

        <Field label="프로그램 설명" required>
          <textarea
            value={form.description}
            onChange={(e) => update('description', e.target.value)}
            className="w-full border rounded px-3 py-2 text-sm min-h-[100px]"
            required
          />
        </Field>

        <Field label="키워드">
          <div className="flex flex-wrap gap-2">
            {KEYWORD_SUGGESTIONS.map((kw) => {
              const selected = form.keywords.includes(kw);
              return (
                <button
                  key={kw}
                  type="button"
                  onClick={() => toggleKeyword(kw)}
                  className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                    selected
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {kw}
                </button>
              );
            })}
          </div>
          {form.keywords.length > 0 && (
            <p className="text-xs text-gray-500 mt-2">
              선택됨: {form.keywords.join(', ')}
            </p>
          )}
        </Field>

        <Field label="판매가 (원)" required>
          <input
            type="number"
            min="0"
            value={form.price}
            onChange={(e) => update('price', e.target.value)}
            className="w-full border rounded px-3 py-2 text-sm"
            required
          />
        </Field>

        <Field label="장소 (도로명주소)" required>
          <input
            type="text"
            value={form.location}
            onChange={(e) => update('location', e.target.value)}
            placeholder="예: 서울특별시 강남구 도곡로 123"
            className="w-full border rounded px-3 py-2 text-sm"
            required
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="정원" required>
            <input
              type="number"
              min="1"
              value={form.maxCapacity}
              onChange={(e) => update('maxCapacity', e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm"
              required
            />
          </Field>
          <Field label="최소 연령" required>
            <input
              type="number"
              min="0"
              value={form.minAge}
              onChange={(e) => update('minAge', e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm"
              required
            />
          </Field>
        </div>

        <Field label="진행 일시" required>
          <input
            type="datetime-local"
            value={form.scheduleAt}
            onChange={(e) => update('scheduleAt', e.target.value)}
            className="w-full border rounded px-3 py-2 text-sm"
            required
          />
        </Field>

        <Field label="예약 마감일">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">활동</span>
            <input
              type="number"
              min="0"
              value={form.bookingDeadlineDays}
              onChange={(e) => update('bookingDeadlineDays', e.target.value)}
              className="w-24 border rounded px-3 py-2 text-sm"
              placeholder="3"
            />
            <span className="text-sm text-gray-500">일 전까지 예약 가능</span>
          </div>
        </Field>

        <Field label="대표 이미지">
          <input
            type="file"
            accept="image/*"
            onChange={handleCoverChange}
            disabled={uploadingCover}
            className="block text-sm"
          />
          {uploadingCover && <p className="text-xs text-gray-500 mt-1">업로드 중...</p>}
          {form.coverImageKey && (
            <p className="text-xs text-green-600 mt-1">
              업로드 완료 ({form.coverImageKey.split('/').pop()})
              <button
                type="button"
                onClick={() => update('coverImageKey', null)}
                className="ml-2 text-red-600 underline"
              >
                제거
              </button>
            </p>
          )}
        </Field>

        <Field label="개별 이미지 (다중 선택 가능)">
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handleGalleryChange}
            disabled={uploadingGallery}
            className="block text-sm"
          />
          {uploadingGallery && <p className="text-xs text-gray-500 mt-1">업로드 중...</p>}
          {form.galleryImageKeys.length > 0 && (
            <ul className="mt-2 space-y-1">
              {form.galleryImageKeys.map((key) => (
                <li key={key} className="text-xs text-gray-700 flex items-center gap-2">
                  <span className="truncate flex-1">{key.split('/').pop()}</span>
                  <button
                    type="button"
                    onClick={() => removeGalleryKey(key)}
                    className="text-red-600 underline"
                  >
                    제거
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Field>

        <Field label="안전 가이드">
          <textarea
            value={form.safetyGuide}
            onChange={(e) => update('safetyGuide', e.target.value)}
            maxLength={500}
            className="w-full border rounded px-3 py-2 text-sm min-h-[80px]"
            placeholder="최대 500자"
          />
        </Field>

        <div className="flex gap-6">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isB2b}
              onChange={(e) => update('isB2b', e.target.checked)}
            />
            B2B 프로그램
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.insuranceCovered}
              onChange={(e) => update('insuranceCovered', e.target.checked)}
            />
            보험 적용
          </label>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-2 pt-2">
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:bg-gray-400"
          >
            {submitting ? '등록 중...' : '등록'}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded text-sm hover:bg-gray-300"
          >
            취소
          </button>
        </div>
      </form>
    </AdminLayout>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}
