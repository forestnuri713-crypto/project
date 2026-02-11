'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AdminLayout from '@/components/AdminLayout';
import { api } from '@/services/api';

interface ProfileData {
  provider: { id: string; name: string; regionTags: string[] | null };
  profile: {
    displayName: string;
    introShort: string | null;
    certificationsText: string | null;
    storyText: string | null;
    coverImageUrls: string[];
    contactLinks: string[];
    isPublished: boolean;
  };
}

export default function ProfileEditorPage() {
  const params = useParams();
  const router = useRouter();
  const providerId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [providerName, setProviderName] = useState('');

  const [displayName, setDisplayName] = useState('');
  const [introShort, setIntroShort] = useState('');
  const [certificationsText, setCertificationsText] = useState('');
  const [storyText, setStoryText] = useState('');
  const [coverImageUrls, setCoverImageUrls] = useState<string[]>([]);
  const [coverImageKeys, setCoverImageKeys] = useState<string[]>([]);
  const [contactLinks, setContactLinks] = useState('');
  const [isPublished, setIsPublished] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.get<ProfileData>(`/admin/providers/${providerId}/profile`);
      setProviderName(data.provider.name);
      setDisplayName(data.profile.displayName);
      setIntroShort(data.profile.introShort || '');
      setCertificationsText(data.profile.certificationsText || '');
      setStoryText(data.profile.storyText || '');
      setCoverImageUrls(data.profile.coverImageUrls || []);
      setContactLinks((data.profile.contactLinks as string[])?.join('\n') || '');
      setIsPublished(data.profile.isPublished);
    } catch {
      // Profile might not exist yet
    }
    setLoading(false);
  }, [providerId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put(`/admin/providers/${providerId}/profile`, {
        displayName,
        introShort: introShort || undefined,
        certificationsText: certificationsText || undefined,
        storyText: storyText || undefined,
        coverImageUrls: coverImageKeys.length > 0 ? coverImageKeys : undefined,
        contactLinks: contactLinks
          .split('\n')
          .map((l) => l.trim())
          .filter(Boolean),
      });
      alert('저장되었습니다');
      load();
    } catch (err: any) {
      alert(err.message || '저장 실패');
    }
    setSaving(false);
  };

  const handleTogglePublish = async () => {
    try {
      await api.patch(`/admin/providers/${providerId}/profile/publish`, {
        isPublished: !isPublished,
      });
      setIsPublished(!isPublished);
    } catch (err: any) {
      alert(err.message || '상태 변경 실패');
    }
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileInfos = Array.from(files).map((f) => ({
      filename: f.name,
      contentType: f.type,
    }));

    try {
      const res = await api.post<{
        uploads: { uploadUrl: string; method: string; finalUrl: string }[];
      }>(`/admin/providers/${providerId}/profile/cover-images/presign`, {
        files: fileInfos,
      });

      await Promise.all(
        res.uploads.map((upload, i) =>
          fetch(upload.uploadUrl, {
            method: upload.method,
            headers: { 'Content-Type': files[i].type },
            body: files[i],
          }),
        ),
      );

      const newKeys = res.uploads.map((u) => u.finalUrl);
      setCoverImageKeys((prev) => [...prev, ...newKeys]);
      alert('이미지가 업로드되었습니다. 저장 버튼을 눌러주세요.');
    } catch (err: any) {
      alert(err.message || '업로드 실패');
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <p className="text-gray-500">로딩 중...</p>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <button
            onClick={() => router.push('/providers')}
            className="text-sm text-gray-500 hover:text-gray-700 mb-1"
          >
            &larr; Provider 목록
          </button>
          <h2 className="text-xl font-bold">
            {providerName} - 미니홈 편집
          </h2>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleTogglePublish}
            className={`px-4 py-2 text-sm rounded ${
              isPublished
                ? 'bg-yellow-500 text-white hover:bg-yellow-600'
                : 'bg-green-600 text-white hover:bg-green-700'
            }`}
          >
            {isPublished ? '비게시로 전환' : '게시하기'}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Form */}
        <div className="space-y-4">
          <div className="bg-white rounded-lg shadow p-5 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                표시명
              </label>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full border rounded px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                한줄 소개 (최대 40자)
              </label>
              <input
                value={introShort}
                onChange={(e) => setIntroShort(e.target.value)}
                maxLength={40}
                className="w-full border rounded px-3 py-2 text-sm"
              />
              <p className="text-xs text-gray-400 mt-1">{introShort.length}/40</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                자격/인증 텍스트
              </label>
              <textarea
                value={certificationsText}
                onChange={(e) => setCertificationsText(e.target.value)}
                rows={3}
                className="w-full border rounded px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                스토리 텍스트
              </label>
              <textarea
                value={storyText}
                onChange={(e) => setStoryText(e.target.value)}
                rows={5}
                className="w-full border rounded px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                연락처 링크 (줄바꿈 구분)
              </label>
              <textarea
                value={contactLinks}
                onChange={(e) => setContactLinks(e.target.value)}
                rows={3}
                className="w-full border rounded px-3 py-2 text-sm"
                placeholder="https://instagram.com/example"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                커버 이미지 (최대 3개)
              </label>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleCoverUpload}
                className="text-sm"
              />
              {coverImageUrls.length > 0 && (
                <div className="flex gap-2 mt-2">
                  {coverImageUrls.map((url, i) => (
                    <img
                      key={i}
                      src={url}
                      alt={`cover-${i}`}
                      className="w-24 h-16 object-cover rounded border"
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: Preview */}
        <div>
          <div className="bg-white rounded-lg shadow p-5">
            <h3 className="text-sm font-medium text-gray-500 mb-4">미리보기</h3>
            {coverImageUrls.length > 0 && (
              <div className="mb-4 rounded-lg overflow-hidden">
                <img
                  src={coverImageUrls[0]}
                  alt="cover"
                  className="w-full h-40 object-cover"
                />
              </div>
            )}
            <h4 className="text-lg font-bold mb-1">{displayName || '표시명'}</h4>
            {introShort && (
              <p className="text-sm text-gray-600 mb-3">{introShort}</p>
            )}
            {certificationsText && (
              <div className="mb-3">
                <p className="text-xs font-medium text-gray-400 mb-1">자격/인증</p>
                <p className="text-sm whitespace-pre-wrap">{certificationsText}</p>
              </div>
            )}
            {storyText && (
              <div className="mb-3">
                <p className="text-xs font-medium text-gray-400 mb-1">스토리</p>
                <p className="text-sm whitespace-pre-wrap">{storyText}</p>
              </div>
            )}
            {contactLinks && (
              <div>
                <p className="text-xs font-medium text-gray-400 mb-1">연락처</p>
                {contactLinks
                  .split('\n')
                  .filter(Boolean)
                  .map((link, i) => (
                    <p key={i} className="text-sm text-blue-600 truncate">
                      {link}
                    </p>
                  ))}
              </div>
            )}
            <div className="mt-4 pt-3 border-t">
              <span
                className={`px-2 py-0.5 rounded text-xs font-medium ${
                  isPublished
                    ? 'bg-green-100 text-green-800'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                {isPublished ? '게시중' : '미게시'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
