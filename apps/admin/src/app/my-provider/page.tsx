'use client';

import { useEffect, useState } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { api } from '@/services/api';

interface ProviderProfile {
  displayName: string;
  introShort: string | null;
  certificationsText: string | null;
  storyText: string | null;
  coverImageUrls: string[];
  contactLinks: string[];
  isPublished: boolean;
}

export default function MyProviderPage() {
  const [profile, setProfile] = useState<ProviderProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  // 로그인 시 저장한 providerMemberships에서 providerId 추출
  const getProviderId = (): string | null => {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      return user.providerMemberships?.[0]?.providerId ?? null;
    } catch {
      return null;
    }
  };

  useEffect(() => {
    const providerId = getProviderId();
    if (!providerId) {
      setLoading(false);
      return;
    }

    api
      .get<{ profile: ProviderProfile }>(`/providers/${providerId}/profile`)
      .then((res) => setProfile(res.profile))
      .catch(() => {
        // 프로필이 없는 경우 빈 폼
        setProfile({
          displayName: '',
          introShort: null,
          certificationsText: null,
          storyText: null,
          coverImageUrls: [],
          contactLinks: [],
          isPublished: false,
        });
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);
    setMessage('');
    try {
      await api.put('/providers/profile', {
        displayName: profile.displayName,
        introShort: profile.introShort || undefined,
        certificationsText: profile.certificationsText || undefined,
        storyText: profile.storyText || undefined,
        contactLinks: profile.contactLinks,
      });
      setMessage('저장되었습니다');
    } catch {
      setMessage('저장에 실패했습니다');
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePublish = async () => {
    if (!profile) return;
    try {
      await api.patch('/providers/profile/publish', {
        isPublished: !profile.isPublished,
      });
      setProfile({ ...profile, isPublished: !profile.isPublished });
    } catch {
      setMessage('공개 상태 변경에 실패했습니다');
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <p className="text-gray-500">로딩 중...</p>
      </AdminLayout>
    );
  }

  if (!getProviderId()) {
    return (
      <AdminLayout>
        <p className="text-gray-500">소속된 업체가 없습니다</p>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold">내 업체 프로필</h2>
        {profile && (
          <button
            onClick={handleTogglePublish}
            className={`px-4 py-2 rounded text-sm font-medium ${
              profile.isPublished
                ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                : 'bg-green-600 text-white hover:bg-green-700'
            }`}
          >
            {profile.isPublished ? '비공개로 전환' : '공개하기'}
          </button>
        )}
      </div>

      {message && (
        <div className="mb-4 p-3 bg-blue-50 text-blue-700 text-sm rounded">
          {message}
        </div>
      )}

      {profile && (
        <div className="bg-white rounded-lg shadow p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              표시명
            </label>
            <input
              type="text"
              value={profile.displayName}
              onChange={(e) =>
                setProfile({ ...profile, displayName: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              한줄 소개 (최대 40자)
            </label>
            <input
              type="text"
              maxLength={40}
              value={profile.introShort ?? ''}
              onChange={(e) =>
                setProfile({ ...profile, introShort: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              자격/인증
            </label>
            <textarea
              rows={3}
              value={profile.certificationsText ?? ''}
              onChange={(e) =>
                setProfile({ ...profile, certificationsText: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              스토리
            </label>
            <textarea
              rows={5}
              value={profile.storyText ?? ''}
              onChange={(e) =>
                setProfile({ ...profile, storyText: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              연락처 링크
            </label>
            {profile.contactLinks.map((link, i) => (
              <div key={i} className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={link}
                  onChange={(e) => {
                    const updated = [...profile.contactLinks];
                    updated[i] = e.target.value;
                    setProfile({ ...profile, contactLinks: updated });
                  }}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                <button
                  onClick={() => {
                    const updated = profile.contactLinks.filter(
                      (_, idx) => idx !== i,
                    );
                    setProfile({ ...profile, contactLinks: updated });
                  }}
                  className="px-3 py-2 text-red-600 text-sm hover:bg-red-50 rounded"
                >
                  삭제
                </button>
              </div>
            ))}
            {profile.contactLinks.length < 3 && (
              <button
                onClick={() =>
                  setProfile({
                    ...profile,
                    contactLinks: [...profile.contactLinks, ''],
                  })
                }
                className="text-sm text-green-600 hover:text-green-700"
              >
                + 링크 추가
              </button>
            )}
          </div>

          <div className="pt-4 border-t">
            <button
              onClick={handleSave}
              disabled={saving || !profile.displayName}
              className="px-6 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {saving ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
