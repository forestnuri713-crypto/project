'use client';

import { useEffect, useState } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { api, ApiError } from '@/services/api';

type GuideKind = 'SAFETY' | 'PAYMENT' | 'CANCEL' | 'INQUIRY';

interface GuideTemplate {
  id: string;
  kind: GuideKind;
  content: string;
  updatedAt: string;
}

const KINDS: { kind: GuideKind; label: string; placeholder: string }[] = [
  {
    kind: 'SAFETY',
    label: '안전 가이드',
    placeholder: '예: 활동 중 안전모 착용 필수, 우천 시 실내 대체 활동 진행',
  },
  {
    kind: 'PAYMENT',
    label: '결제 안내',
    placeholder: '예: 결제는 카드/계좌이체로 가능합니다. 결제 즉시 예약이 확정됩니다.',
  },
  {
    kind: 'CANCEL',
    label: '취소 안내',
    placeholder: '예: 활동 7일 전까지 100% 환불, 3일 전까지 50%, 이후 환불 불가',
  },
  {
    kind: 'INQUIRY',
    label: '문의 안내',
    placeholder: '예: 평일 09:00~18:00, 카카오톡 채널 @sooptalk',
  },
];

export default function GuideTemplatesPage() {
  const [templates, setTemplates] = useState<Record<GuideKind, string>>({
    SAFETY: '',
    PAYMENT: '',
    CANCEL: '',
    INQUIRY: '',
  });
  const [savingKind, setSavingKind] = useState<GuideKind | null>(null);
  const [savedKind, setSavedKind] = useState<GuideKind | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
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
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const handleSave = async (kind: GuideKind) => {
    setError(null);
    setSavedKind(null);
    const content = templates[kind].trim();
    if (!content) {
      setError('내용을 입력해주세요');
      return;
    }
    setSavingKind(kind);
    try {
      await api.put('/admin/guide-templates', { kind, content });
      setSavedKind(kind);
      setTimeout(() => setSavedKind(null), 2000);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : '저장 중 오류가 발생했습니다';
      setError(message);
    } finally {
      setSavingKind(null);
    }
  };

  return (
    <AdminLayout>
      <h2 className="text-xl font-bold mb-2">안내 템플릿</h2>
      <p className="text-sm text-gray-500 mb-6">
        프로그램 등록 시 "기본 정보 사용"을 선택하면 여기에 등록된 본문이 적용됩니다.
      </p>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          {error}
        </div>
      )}

      {!loaded ? (
        <p className="text-gray-500">로딩 중...</p>
      ) : (
        <div className="space-y-6 max-w-3xl">
          {KINDS.map(({ kind, label, placeholder }) => (
            <section key={kind} className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">{label}</h3>
                {savedKind === kind && (
                  <span className="text-xs text-green-600">저장되었습니다</span>
                )}
              </div>
              <textarea
                value={templates[kind]}
                onChange={(e) =>
                  setTemplates((prev) => ({ ...prev, [kind]: e.target.value }))
                }
                placeholder={placeholder}
                className="w-full border rounded px-3 py-2 text-sm min-h-[120px]"
                maxLength={5000}
              />
              <div className="flex justify-end mt-3">
                <button
                  type="button"
                  onClick={() => handleSave(kind)}
                  disabled={savingKind === kind}
                  className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:bg-gray-400"
                >
                  {savingKind === kind ? '저장 중...' : '저장'}
                </button>
              </div>
            </section>
          ))}
        </div>
      )}
    </AdminLayout>
  );
}
