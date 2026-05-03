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

interface OptionRow {
  name: string;
  priceDiff: string;
  capacity: string;
}

type ScheduleMode = 'SINGLE' | 'RECURRING';
type RecurrenceFrequency = 'WEEKLY' | 'MONTHLY';
type EndMode = 'BY_DATE' | 'BY_COUNT';

interface RecurrenceState {
  frequency: RecurrenceFrequency;
  startDate: string;
  startTime: string;
  endTime: string;
  endMode: EndMode;
  endDate: string;
  count: string;
  daysOfWeek: number[];
  dayOfMonth: string;
  capacity: string;
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
  scheduleMode: ScheduleMode;
  scheduleAt: string;
  recurrence: RecurrenceState;
  bookingDeadlineDays: string;
  isB2b: boolean;
  safetyGuide: GuideField;
  paymentGuide: GuideField;
  cancelGuide: GuideField;
  inquiryGuide: GuideField;
  insuranceCovered: boolean;
  coverImageKey: string | null;
  galleryImageKeys: string[];
  options: OptionRow[];
}

type GuideKind = 'SAFETY' | 'PAYMENT' | 'CANCEL' | 'INQUIRY';

type GuideMode = 'DEFAULT' | 'CUSTOM';

interface GuideField {
  mode: GuideMode;
  custom: string;
}

const INITIAL_GUIDE: GuideField = { mode: 'DEFAULT', custom: '' };

interface GuideTemplate {
  id: string;
  kind: GuideKind;
  content: string;
}

const INITIAL_RECURRENCE: RecurrenceState = {
  frequency: 'WEEKLY',
  startDate: '',
  startTime: '10:00',
  endTime: '',
  endMode: 'BY_DATE',
  endDate: '',
  count: '',
  daysOfWeek: [],
  dayOfMonth: '',
  capacity: '',
};

const INITIAL: FormState = {
  instructorId: '',
  title: '',
  description: '',
  keywords: [],
  location: '',
  price: '',
  maxCapacity: '',
  minAge: '',
  scheduleMode: 'SINGLE',
  scheduleAt: '',
  recurrence: INITIAL_RECURRENCE,
  bookingDeadlineDays: '',
  isB2b: false,
  safetyGuide: INITIAL_GUIDE,
  paymentGuide: INITIAL_GUIDE,
  cancelGuide: INITIAL_GUIDE,
  inquiryGuide: INITIAL_GUIDE,
  insuranceCovered: false,
  coverImageKey: null,
  galleryImageKeys: [],
  options: [],
};

const DOW_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

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
  const [templates, setTemplates] = useState<Record<GuideKind, string>>({
    SAFETY: '',
    PAYMENT: '',
    CANCEL: '',
    INQUIRY: '',
  });

  useEffect(() => {
    api
      .get<InstructorsResponse>('/admin/instructors?status=APPROVED&page=1&limit=100')
      .then((res) => setInstructors(res.items))
      .catch(() => setInstructors([]));
    api
      .get<GuideTemplate[]>('/admin/guide-templates')
      .then((rows) => {
        const next: Record<GuideKind, string> = {
          SAFETY: '',
          PAYMENT: '',
          CANCEL: '',
          INQUIRY: '',
        };
        rows.forEach((r) => {
          next[r.kind] = r.content;
        });
        setTemplates(next);
      })
      .catch(() => {});
  }, []);

  const updateGuide = (
    key: 'safetyGuide' | 'paymentGuide' | 'cancelGuide' | 'inquiryGuide',
    patch: Partial<GuideField>,
  ) => {
    setForm((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  };

  const resolveGuide = (kind: GuideKind, field: GuideField): string => {
    if (field.mode === 'CUSTOM') return field.custom.trim();
    return templates[kind];
  };

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

  const [recommendedKeywords, setRecommendedKeywords] = useState<string[]>([]);
  const [recommending, setRecommending] = useState(false);

  const handleRecommendKeywords = async () => {
    const description = form.description.trim();
    if (description.length < 10) {
      setError('설명을 10자 이상 입력한 뒤 다시 시도해주세요');
      return;
    }
    setError(null);
    setRecommending(true);
    try {
      const { keywords } = await api.post<{ keywords: string[] }>(
        '/admin/programs/keywords/recommend',
        { description },
      );
      setRecommendedKeywords(keywords);
      setForm((prev) => ({
        ...prev,
        keywords: Array.from(new Set([...prev.keywords, ...keywords])),
      }));
    } catch (err) {
      const message = err instanceof ApiError ? err.message : '키워드 추천에 실패했습니다';
      setError(message);
    } finally {
      setRecommending(false);
    }
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

  const updateRecurrence = <K extends keyof RecurrenceState>(
    key: K,
    value: RecurrenceState[K],
  ) => {
    setForm((prev) => ({ ...prev, recurrence: { ...prev.recurrence, [key]: value } }));
  };

  const toggleDow = (d: number) => {
    setForm((prev) => {
      const has = prev.recurrence.daysOfWeek.includes(d);
      const next = has
        ? prev.recurrence.daysOfWeek.filter((x) => x !== d)
        : [...prev.recurrence.daysOfWeek, d].sort();
      return { ...prev, recurrence: { ...prev.recurrence, daysOfWeek: next } };
    });
  };

  const addOption = () =>
    setForm((prev) => ({
      ...prev,
      options: [...prev.options, { name: '', priceDiff: '', capacity: '' }],
    }));

  const removeOption = (idx: number) =>
    setForm((prev) => ({
      ...prev,
      options: prev.options.filter((_, i) => i !== idx),
    }));

  const updateOption = (idx: number, key: keyof OptionRow, value: string) =>
    setForm((prev) => ({
      ...prev,
      options: prev.options.map((o, i) => (i === idx ? { ...o, [key]: value } : o)),
    }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!form.instructorId) {
      setError('강사를 선택해주세요');
      return;
    }

    let recurrencePayload: object | null = null;
    if (form.scheduleMode === 'RECURRING') {
      const r = form.recurrence;
      if (!r.startDate) {
        setError('반복 시작일을 입력해주세요');
        return;
      }
      if (!r.capacity) {
        setError('회차당 정원을 입력해주세요');
        return;
      }
      if (r.endMode === 'BY_DATE' && !r.endDate) {
        setError('반복 종료일을 입력해주세요');
        return;
      }
      if (r.endMode === 'BY_COUNT' && !r.count) {
        setError('반복 횟수를 입력해주세요');
        return;
      }
      if (r.frequency === 'WEEKLY' && r.daysOfWeek.length === 0) {
        setError('주간 반복은 최소 1개 요일을 선택해주세요');
        return;
      }
      recurrencePayload = {
        frequency: r.frequency,
        startDate: r.startDate,
        startTime: r.startTime,
        ...(r.endTime ? { endTime: r.endTime } : {}),
        ...(r.endMode === 'BY_DATE' && r.endDate ? { endDate: r.endDate } : {}),
        ...(r.endMode === 'BY_COUNT' && r.count ? { count: parseInt(r.count, 10) } : {}),
        ...(r.frequency === 'WEEKLY' ? { daysOfWeek: r.daysOfWeek } : {}),
        ...(r.frequency === 'MONTHLY' && r.dayOfMonth
          ? { dayOfMonth: parseInt(r.dayOfMonth, 10) }
          : {}),
        capacity: parseInt(r.capacity, 10),
      };
    } else if (!form.scheduleAt) {
      setError('진행 일시를 입력해주세요');
      return;
    }

    const optionsPayload = form.options
      .filter((o) => o.name.trim())
      .map((o) => ({
        name: o.name.trim(),
        ...(o.priceDiff ? { priceDiff: parseInt(o.priceDiff, 10) } : {}),
        ...(o.capacity ? { capacity: parseInt(o.capacity, 10) } : {}),
      }));

    const payload = {
      instructorId: form.instructorId,
      title: form.title.trim(),
      description: form.description.trim(),
      keywords: form.keywords,
      location: form.location.trim(),
      price: parseInt(form.price, 10),
      maxCapacity: parseInt(form.maxCapacity, 10),
      minAge: parseInt(form.minAge, 10),
      ...(form.scheduleMode === 'SINGLE'
        ? { scheduleAt: new Date(form.scheduleAt).toISOString() }
        : {}),
      ...(recurrencePayload ? { recurrence: recurrencePayload } : {}),
      isB2b: form.isB2b,
      insuranceCovered: form.insuranceCovered,
      ...(resolveGuide('SAFETY', form.safetyGuide)
        ? { safetyGuide: resolveGuide('SAFETY', form.safetyGuide) }
        : {}),
      ...(resolveGuide('PAYMENT', form.paymentGuide)
        ? { paymentGuide: resolveGuide('PAYMENT', form.paymentGuide) }
        : {}),
      ...(resolveGuide('CANCEL', form.cancelGuide)
        ? { cancelGuide: resolveGuide('CANCEL', form.cancelGuide) }
        : {}),
      ...(resolveGuide('INQUIRY', form.inquiryGuide)
        ? { inquiryGuide: resolveGuide('INQUIRY', form.inquiryGuide) }
        : {}),
      ...(form.coverImageKey ? { coverImageKey: form.coverImageKey } : {}),
      ...(form.galleryImageKeys.length > 0 ? { galleryImageKeys: form.galleryImageKeys } : {}),
      ...(form.bookingDeadlineDays
        ? { bookingDeadlineDays: parseInt(form.bookingDeadlineDays, 10) }
        : {}),
      ...(optionsPayload.length > 0 ? { options: optionsPayload } : {}),
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
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-gray-500">
              아래 추천 또는 직접 입력한 설명을 기반으로 키워드를 선택하세요.
            </p>
            <button
              type="button"
              onClick={handleRecommendKeywords}
              disabled={recommending}
              className="px-3 py-1 text-xs rounded border border-blue-600 text-blue-600 hover:bg-blue-50 disabled:opacity-50"
            >
              {recommending ? '추천 중...' : '설명 기반 키워드 추천'}
            </button>
          </div>

          {recommendedKeywords.length > 0 && (
            <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded">
              <p className="text-xs font-medium text-blue-700 mb-2">AI 추천 키워드</p>
              <div className="flex flex-wrap gap-2">
                {recommendedKeywords.map((kw) => {
                  const selected = form.keywords.includes(kw);
                  return (
                    <button
                      key={kw}
                      type="button"
                      onClick={() => toggleKeyword(kw)}
                      className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                        selected
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-blue-700 border-blue-400 hover:bg-blue-100'
                      }`}
                    >
                      {kw}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

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

        <Field label="일정 유형" required>
          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={form.scheduleMode === 'SINGLE'}
                onChange={() => update('scheduleMode', 'SINGLE')}
              />
              단일 일정
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={form.scheduleMode === 'RECURRING'}
                onChange={() => update('scheduleMode', 'RECURRING')}
              />
              반복 일정
            </label>
          </div>
        </Field>

        {form.scheduleMode === 'SINGLE' ? (
          <Field label="진행 일시" required>
            <input
              type="datetime-local"
              value={form.scheduleAt}
              onChange={(e) => update('scheduleAt', e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm"
              required
            />
          </Field>
        ) : (
          <div className="border rounded-lg p-4 space-y-4 bg-gray-50">
            <div className="grid grid-cols-2 gap-4">
              <Field label="반복 주기">
                <select
                  value={form.recurrence.frequency}
                  onChange={(e) =>
                    updateRecurrence('frequency', e.target.value as RecurrenceFrequency)
                  }
                  className="w-full border rounded px-3 py-2 text-sm"
                >
                  <option value="WEEKLY">매주</option>
                  <option value="MONTHLY">매월</option>
                </select>
              </Field>
              <Field label="회차당 정원" required>
                <input
                  type="number"
                  min="1"
                  value={form.recurrence.capacity}
                  onChange={(e) => updateRecurrence('capacity', e.target.value)}
                  className="w-full border rounded px-3 py-2 text-sm"
                />
              </Field>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <Field label="시작일" required>
                <input
                  type="date"
                  value={form.recurrence.startDate}
                  onChange={(e) => updateRecurrence('startDate', e.target.value)}
                  className="w-full border rounded px-3 py-2 text-sm"
                />
              </Field>
              <Field label="시작 시각" required>
                <input
                  type="time"
                  value={form.recurrence.startTime}
                  onChange={(e) => updateRecurrence('startTime', e.target.value)}
                  className="w-full border rounded px-3 py-2 text-sm"
                />
              </Field>
              <Field label="종료 시각">
                <input
                  type="time"
                  value={form.recurrence.endTime}
                  onChange={(e) => updateRecurrence('endTime', e.target.value)}
                  className="w-full border rounded px-3 py-2 text-sm"
                />
              </Field>
            </div>

            {form.recurrence.frequency === 'WEEKLY' ? (
              <Field label="요일 (다중 선택)">
                <div className="flex gap-2">
                  {DOW_LABELS.map((label, i) => {
                    const selected = form.recurrence.daysOfWeek.includes(i);
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => toggleDow(i)}
                        className={`w-10 h-10 rounded-full text-sm border ${
                          selected
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white text-gray-700 border-gray-300'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </Field>
            ) : (
              <Field label="매월 일자 (1~28)">
                <input
                  type="number"
                  min="1"
                  max="28"
                  value={form.recurrence.dayOfMonth}
                  onChange={(e) => updateRecurrence('dayOfMonth', e.target.value)}
                  className="w-32 border rounded px-3 py-2 text-sm"
                  placeholder="비우면 시작일과 동일"
                />
              </Field>
            )}

            <Field label="종료 조건" required>
              <div className="flex gap-4 text-sm mb-2">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={form.recurrence.endMode === 'BY_DATE'}
                    onChange={() => updateRecurrence('endMode', 'BY_DATE')}
                  />
                  종료일 지정
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={form.recurrence.endMode === 'BY_COUNT'}
                    onChange={() => updateRecurrence('endMode', 'BY_COUNT')}
                  />
                  횟수 지정
                </label>
              </div>
              {form.recurrence.endMode === 'BY_DATE' ? (
                <input
                  type="date"
                  value={form.recurrence.endDate}
                  onChange={(e) => updateRecurrence('endDate', e.target.value)}
                  className="w-full border rounded px-3 py-2 text-sm"
                />
              ) : (
                <input
                  type="number"
                  min="1"
                  value={form.recurrence.count}
                  onChange={(e) => updateRecurrence('count', e.target.value)}
                  className="w-32 border rounded px-3 py-2 text-sm"
                  placeholder="총 횟수"
                />
              )}
            </Field>
          </div>
        )}

        <Field label="옵션 (선택 사항)">
          <div className="space-y-2">
            {form.options.map((o, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                <input
                  type="text"
                  placeholder="옵션명 (예: 오전반)"
                  value={o.name}
                  onChange={(e) => updateOption(idx, 'name', e.target.value)}
                  className="col-span-5 border rounded px-3 py-2 text-sm"
                />
                <input
                  type="number"
                  placeholder="가격 차이"
                  value={o.priceDiff}
                  onChange={(e) => updateOption(idx, 'priceDiff', e.target.value)}
                  className="col-span-3 border rounded px-3 py-2 text-sm"
                />
                <input
                  type="number"
                  min="1"
                  placeholder="정원"
                  value={o.capacity}
                  onChange={(e) => updateOption(idx, 'capacity', e.target.value)}
                  className="col-span-3 border rounded px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={() => removeOption(idx)}
                  className="col-span-1 text-red-600 text-sm"
                >
                  삭제
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addOption}
              className="text-sm text-blue-600 hover:underline"
            >
              + 옵션 추가
            </button>
          </div>
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

        <GuideSection
          label="안전 가이드"
          formKey="safetyGuide"
          field={form.safetyGuide}
          template={templates.SAFETY}
          onChange={updateGuide}
        />
        <GuideSection
          label="결제 안내"
          formKey="paymentGuide"
          field={form.paymentGuide}
          template={templates.PAYMENT}
          onChange={updateGuide}
        />
        <GuideSection
          label="취소 안내"
          formKey="cancelGuide"
          field={form.cancelGuide}
          template={templates.CANCEL}
          onChange={updateGuide}
        />
        <GuideSection
          label="문의 안내"
          formKey="inquiryGuide"
          field={form.inquiryGuide}
          template={templates.INQUIRY}
          onChange={updateGuide}
        />

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

function GuideSection({
  label,
  formKey,
  field,
  template,
  onChange,
}: {
  label: string;
  formKey: 'safetyGuide' | 'paymentGuide' | 'cancelGuide' | 'inquiryGuide';
  field: GuideField;
  template: string;
  onChange: (
    key: 'safetyGuide' | 'paymentGuide' | 'cancelGuide' | 'inquiryGuide',
    patch: Partial<GuideField>,
  ) => void;
}) {
  const hasTemplate = template.trim().length > 0;
  return (
    <Field label={label}>
      <div className="flex gap-4 text-sm mb-2">
        <label className="flex items-center gap-2">
          <input
            type="radio"
            checked={field.mode === 'DEFAULT'}
            onChange={() => onChange(formKey, { mode: 'DEFAULT' })}
          />
          기본 정보 사용
          {!hasTemplate && (
            <span className="text-xs text-gray-400">(템플릿 미설정)</span>
          )}
        </label>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            checked={field.mode === 'CUSTOM'}
            onChange={() => onChange(formKey, { mode: 'CUSTOM' })}
          />
          직접 등록
        </label>
      </div>
      {field.mode === 'DEFAULT' ? (
        <div className="text-xs text-gray-600 bg-gray-50 border rounded p-3 whitespace-pre-wrap min-h-[60px]">
          {hasTemplate ? template : '안내 템플릿 메뉴에서 기본 본문을 등록해주세요.'}
        </div>
      ) : (
        <textarea
          value={field.custom}
          onChange={(e) => onChange(formKey, { custom: e.target.value })}
          maxLength={5000}
          className="w-full border rounded px-3 py-2 text-sm min-h-[100px]"
          placeholder="직접 입력"
        />
      )}
    </Field>
  );
}
