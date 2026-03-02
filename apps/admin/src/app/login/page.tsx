'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

const KAKAO_JS_KEY = process.env.NEXT_PUBLIC_KAKAO_JS_KEY || '';
const KAKAO_REDIRECT_URI = process.env.NEXT_PUBLIC_KAKAO_REDIRECT_URI || '';

declare global {
  interface Window {
    Kakao: any;
  }
}

export default function LoginPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [sdkReady, setSdkReady] = useState(false);
  const [sdkError, setSdkError] = useState('');

  useEffect(() => {
    if (!isLoading && user?.role === 'ADMIN') {
      router.replace('/');
    }
  }, [user, isLoading, router]);

  useEffect(() => {
    if (!KAKAO_JS_KEY) {
      setSdkError('카카오 API 키가 설정되지 않았습니다');
      return;
    }

    if (window.Kakao) {
      if (!window.Kakao.isInitialized()) {
        window.Kakao.init(KAKAO_JS_KEY);
      }
      setSdkReady(true);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://t1.kakaocdn.net/kakao_js_sdk/2.7.4/kakao.min.js';
    script.onload = () => {
      if (window.Kakao && !window.Kakao.isInitialized()) {
        window.Kakao.init(KAKAO_JS_KEY);
      }
      setSdkReady(true);
    };
    script.onerror = () => {
      setSdkError('Kakao SDK를 불러오지 못했습니다');
    };
    document.head.appendChild(script);
  }, []);

  const handleKakaoLogin = () => {
    if (!window.Kakao || !window.Kakao.isInitialized()) {
      setSdkError('Kakao SDK가 로드되지 않았습니다. 페이지를 새로고침 해주세요.');
      return;
    }

    const redirectUri = KAKAO_REDIRECT_URI || `${window.location.origin}/login/callback`;
    window.Kakao.Auth.authorize({ redirectUri });
  };

  if (isLoading) return null;

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="w-full max-w-sm bg-white rounded-lg shadow-md p-8">
        <h1 className="text-2xl font-bold text-center mb-2">숲똑 Admin</h1>
        <p className="text-sm text-gray-500 text-center mb-8">관리자 로그인</p>

        {sdkError && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded">
            {sdkError}
          </div>
        )}

        <button
          onClick={handleKakaoLogin}
          disabled={!sdkReady}
          className="w-full py-3 bg-yellow-400 hover:bg-yellow-500 disabled:bg-gray-300 disabled:cursor-not-allowed text-gray-900 font-medium rounded-lg transition-colors"
        >
          {sdkReady ? '카카오로 로그인' : '로딩 중...'}
        </button>
      </div>
    </div>
  );
}
