'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { api, ApiError } from '@/services/api';

const KAKAO_JS_KEY = process.env.NEXT_PUBLIC_KAKAO_JS_KEY || '';
const KAKAO_REDIRECT_URI = process.env.NEXT_PUBLIC_KAKAO_REDIRECT_URI || '';
const ENABLE_DEV_LOGIN = process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_ENABLE_DEV_LOGIN === 'true';

declare global {
  interface Window {
    Kakao: any;
  }
}

export default function LoginPage() {
  const { user, isLoading, login } = useAuth();
  const router = useRouter();
  const [sdkReady, setSdkReady] = useState(false);
  const [sdkError, setSdkError] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

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

  const handleDevLogin = () => {
    login('dev-token', { id: 'dev', email: 'dev@admin', name: 'Dev Admin', role: 'ADMIN' });
    router.replace('/');
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);

    try {
      const res = await api.post<{ accessToken: string; user: any }>('/auth/login', {
        email,
        password,
      });

      if (res.user.role !== 'ADMIN') {
        setLoginError('관리자 권한이 없습니다');
        return;
      }

      login(res.accessToken, res.user);
      router.replace('/');
    } catch (err) {
      if (err instanceof ApiError) {
        setLoginError(err.message);
      } else {
        setLoginError('로그인에 실패했습니다');
      }
    } finally {
      setLoginLoading(false);
    }
  };

  if (isLoading) return null;

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="w-full max-w-sm bg-white rounded-lg shadow-md p-8">
        <h1 className="text-2xl font-bold text-center mb-2">숲똑 Admin</h1>
        <p className="text-sm text-gray-500 text-center mb-8">관리자 로그인</p>

        {(sdkError || loginError) && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded">
            {loginError || sdkError}
          </div>
        )}

        <form onSubmit={handleEmailLogin} className="space-y-4 mb-6">
          <div>
            <input
              type="email"
              placeholder="이메일"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
            />
          </div>
          <div>
            <input
              type="password"
              placeholder="비밀번호"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={loginLoading}
            className="w-full py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
          >
            {loginLoading ? '로그인 중...' : '로그인'}
          </button>
        </form>

        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white text-gray-500">또는</span>
          </div>
        </div>

        <button
          onClick={handleKakaoLogin}
          disabled={!sdkReady}
          className="w-full py-3 bg-yellow-400 hover:bg-yellow-500 disabled:bg-gray-300 disabled:cursor-not-allowed text-gray-900 font-medium rounded-lg transition-colors"
        >
          {sdkReady ? '카카오로 로그인' : '로딩 중...'}
        </button>

        {ENABLE_DEV_LOGIN && (
          <>
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">개발 전용</span>
              </div>
            </div>
            <button
              onClick={handleDevLogin}
              className="w-full py-3 bg-gray-800 hover:bg-gray-900 text-white font-medium rounded-lg transition-colors"
            >
              개발 모드 로그인 (백엔드 불필요)
            </button>
          </>
        )}
      </div>
    </div>
  );
}
