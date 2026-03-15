'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { api, ApiError } from '@/services/api';

const KAKAO_REDIRECT_URI = process.env.NEXT_PUBLIC_KAKAO_REDIRECT_URI || '';

export default function KakaoCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen bg-gray-100">
          <div className="w-full max-w-sm bg-white rounded-lg shadow-md p-8 text-center">
            <p className="text-gray-500">로그인 처리 중...</p>
          </div>
        </div>
      }
    >
      <KakaoCallbackContent />
    </Suspense>
  );
}

function KakaoCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();
  const [error, setError] = useState('');

  useEffect(() => {
    const code = searchParams.get('code');
    const kakaoError = searchParams.get('error');
    const state = searchParams.get('state');

    if (kakaoError) {
      setError('카카오 로그인이 취소되었습니다');
      return;
    }

    if (!code) {
      setError('인가 코드가 없습니다');
      return;
    }

    const redirectUri = KAKAO_REDIRECT_URI || `${window.location.origin}/login/callback`;
    const isSignup = state === 'signup';

    (async () => {
      try {
        const body: Record<string, string> = { code, redirectUri };
        if (isSignup) {
          body.role = 'ADMIN';
        }

        const res = await api.post<{ accessToken: string; user: any }>('/auth/kakao', body);

        if (res.user.role !== 'ADMIN') {
          setError('관리자 권한이 없습니다');
          return;
        }

        login(res.accessToken, res.user);
        router.replace('/');
      } catch (err) {
        if (err instanceof ApiError) {
          setError(err.message);
        } else {
          setError(isSignup ? '회원가입에 실패했습니다' : '로그인에 실패했습니다');
        }
      }
    })();
  }, [searchParams, login, router]);

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="w-full max-w-sm bg-white rounded-lg shadow-md p-8 text-center">
          <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded">{error}</div>
          <button
            onClick={() => router.replace('/login')}
            className="text-sm text-gray-500 hover:text-gray-700 underline"
          >
            로그인 페이지로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="w-full max-w-sm bg-white rounded-lg shadow-md p-8 text-center">
        <p className="text-gray-500">로그인 처리 중...</p>
      </div>
    </div>
  );
}
