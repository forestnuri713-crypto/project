'use client';

import { useEffect, useState } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { api, ApiError } from '@/services/api';

type GuideKind = 'SAFETY' | 'PAYMENT' | 'CANCEL' | 'INQUIRY';

interface GuideTemplate {
  id: string;
  kind: GuideKind;
  title: string;
  content: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

interface FormState {
  kind: GuideKind;
  title: string;
  content: string;
  isDefault: boolean;
}

const KINDS: GuideKind[] = ['SAFETY', 'PAYMENT', 'CANCEL', 'INQUIRY'];

const KIND_LABELS: Record<GuideKind, string> = {
  SAFETY: '안전 가이드',
  PAYMENT: '결제 안내',
  CANCEL: '취소 안내',
  INQUIRY: '문의 안내',
};

const KIND_COLORS: Record<GuideKind, string> = {
  SAFETY: 'bg-green-100 text-green-800',
  PAYMENT: 'bg-blue-100 text-blue-800',
  CANCEL: 'bg-red-100 text-red-800',
  INQUIRY: 'bg-purple-100 text-purple-800',
};

const EMPTY_FORM: FormState = { kind: 'SAFETY', title: '', content: '', isDefault: false };

export default function GuideTemplatesPage() {
  const [templates, setTemplates] = useState<GuideTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterKind, setFilterKind] = useState<GuideKind | 'ALL'>('ALL');
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<GuideTemplate | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchTemplates = () => {
    setLoading(true);
    api
      .get<GuideTemplate[]>('/admin/guide-templates')
      .then(setTemplates)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const openCreate = () => {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (t: GuideTemplate) => {
    setEditTarget(t);
    setForm({ kind: t.kind, title: t.title, content: t.content, isDefault: t.isDefault });
    setFormError(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditTarget(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('이 템플릿을 삭제하시겠습니까?')) return;
    try {
      await api.delete(`/admin/guide-templates/${id}`);
      setTemplates((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      alert(err instanceof ApiError ? err.message : '삭제 중 오류가 발생했습니다.');
    }
  };

  const handleSubmit = async () => {
    setFormError(null);
    if (!form.title.trim()) {
      setFormError('제목을 입력해주세요.');
      return;
    }
    if (!form.content.trim()) {
      setFormError('안내 내용을 입력해주세요.');
      return;
    }

    setSaving(true);
    try {
      if (editTarget) {
        const updated = await api.patch<GuideTemplate>(`/admin/guide-templates/${editTarget.id}`, {
          title: form.title.trim(),
          content: form.content.trim(),
          isDefault: form.isDefault,
        });
        setTemplates((prev) => prev.map((t) => (t.id === editTarget.id ? updated : t)));
      } else {
        const created = await api.post<GuideTemplate>('/admin/guide-templates', {
          kind: form.kind,
          title: form.title.trim(),
          content: form.content.trim(),
          isDefault: form.isDefault,
        });
        setTemplates((prev) => [...prev, created]);
      }
      closeModal();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : '저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const filtered =
    filterKind === 'ALL' ? templates : templates.filter((t) => t.kind === filterKind);
  const defaultTemplates = filtered.filter((t) => t.isDefault);
  const customTemplates = filtered.filter((t) => !t.isDefault);

  return (
    <AdminLayout>
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">안내 템플릿 관리</h2>
          <p className="text-sm text-gray-500 mt-1">
            프로그램 등록 시 불러올 수 있는 안내 문구 템플릿을 관리합니다.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          + 신규 템플릿 등록
        </button>
      </div>

      {/* 카테고리 필터 탭 */}
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {(['ALL', ...KINDS] as const).map((k) => (
          <button
            key={k}
            onClick={() => setFilterKind(k)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              filterKind === k
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            {k === 'ALL' ? '전체' : KIND_LABELS[k]}
          </button>
        ))}
      </div>

      {/* 목록 */}
      {loading ? (
        <p className="text-sm text-gray-400">로딩 중...</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-base font-medium">등록된 템플릿이 없습니다</p>
          <p className="text-sm mt-1">상단 버튼으로 새 템플릿을 추가해보세요.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {defaultTemplates.length > 0 && (
            <TemplateSection
              sectionTitle="기본 제공 템플릿"
              templates={defaultTemplates}
              onEdit={openEdit}
              onDelete={handleDelete}
            />
          )}
          {customTemplates.length > 0 && (
            <TemplateSection
              sectionTitle="업체 커스텀 템플릿"
              templates={customTemplates}
              onEdit={openEdit}
              onDelete={handleDelete}
            />
          )}
        </div>
      )}

      {/* 등록/수정 모달 */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                {editTarget ? '템플릿 수정' : '신규 템플릿 등록'}
              </h3>
              <button
                onClick={closeModal}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  카테고리 <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.kind}
                  onChange={(e) => setForm((p) => ({ ...p, kind: e.target.value as GuideKind }))}
                  disabled={!!editTarget}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
                >
                  {KINDS.map((k) => (
                    <option key={k} value={k}>
                      {KIND_LABELS[k]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  제목 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                  placeholder="관리용 템플릿 제목을 입력하세요"
                  maxLength={100}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  안내 내용 <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={form.content}
                  onChange={(e) => setForm((p) => ({ ...p, content: e.target.value }))}
                  placeholder="실제 안내 문구를 입력하세요"
                  maxLength={5000}
                  rows={6}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
                <p className="text-xs text-gray-400 text-right mt-1">
                  {form.content.length} / 5,000
                </p>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isDefault"
                  checked={form.isDefault}
                  onChange={(e) => setForm((p) => ({ ...p, isDefault: e.target.checked }))}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600"
                />
                <label htmlFor="isDefault" className="text-sm text-gray-700">
                  기본 제공 템플릿으로 설정
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200">
              <button
                onClick={closeModal}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleSubmit}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
              >
                {saving ? '저장 중...' : editTarget ? '수정' : '등록'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

function TemplateSection({
  sectionTitle,
  templates,
  onEdit,
  onDelete,
}: {
  sectionTitle: string;
  templates: GuideTemplate[];
  onEdit: (t: GuideTemplate) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <section>
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
        {sectionTitle}
      </h3>
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide w-[45%]">
                제목
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                카테고리
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                수정일
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">
                액션
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {templates.map((t) => (
              <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">{t.title}</span>
                    {t.isDefault && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
                        기본
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5 line-clamp-1 max-w-sm">
                    {t.content}
                  </p>
                </td>
                <td className="px-6 py-4">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${KIND_COLORS[t.kind]}`}
                  >
                    {KIND_LABELS[t.kind]}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-500 whitespace-nowrap">
                  {new Date(t.updatedAt).toLocaleDateString('ko-KR')}
                </td>
                <td className="px-6 py-4 text-right whitespace-nowrap">
                  <button
                    onClick={() => onEdit(t)}
                    className="text-sm text-blue-600 hover:text-blue-800 mr-4"
                  >
                    수정
                  </button>
                  <button
                    onClick={() => onDelete(t.id)}
                    className="text-sm text-red-500 hover:text-red-700"
                  >
                    삭제
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
