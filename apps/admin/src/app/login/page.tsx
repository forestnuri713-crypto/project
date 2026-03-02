'use client';

import { useEffect } from 'react';
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

  useEffect(() => {
    if (!isLoading && user?.role === 'ADMIN') {
      router.replace('/');
    }
  }, [user, isLoading, router]);

  useEffect(() => {
    if (!KAKAO_JS_KEY) return;
    const script = document.createElement('script');
    script.src = 'https://t1.kakaocdn.net/kakao_js_sdk/2.7.4/kakao.min.js';
    script.onload = () => {
      if (window.Kakao && !window.Kakao.isInitialized()) {
        window.Kakao.init(KAKAO_JS_KEY);
      }
    };
    document.head.appendChild(script);
  }, []);

  const handleKakaoLogin = () => {
    if (!window.Kakao) return;

    const redirectUri = KAKAO_REDIRECT_URI || `${window.location.origin}/login/callback`;
    window.Kakao.Auth.authorize({ redirectUri });
  };

  if (isLoading) return null;

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="w-full max-w-sm bg-white rounded-lg shadow-md p-8">
        <h1 className="text-2xl font-bold text-center mb-2">숲똑 Admin</h1>
        <p className="text-sm text-gray-500 text-center mb-8">관리자 로그인</p>

        <button
          onClick={handleKakaoLogin}
          className="w-full py-3 bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-medium rounded-lg transition-colors"
        >
          카카오로 로그인
        </button>
      </div>
    </div>
  );
}
