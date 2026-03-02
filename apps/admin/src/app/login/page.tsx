'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { api, ApiError } from '@/services/api';

const KAKAO_JS_KEY = process.env.NEXT_PUBLIC_KAKAO_JS_KEY || '';
const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';

declare global {
  interface Window {
    Kakao: any;
    google: any;
  }
}

export default function LoginPage() {
  const { user, isLoading, login } = useAuth();
  const router = useRouter();
  const [error, setError] = useState('');
  const [logging, setLogging] = useState(false);

  useEffect(() => {
    if (!isLoading && user?.role === 'ADMIN') {
      router.replace('/');
    }
  }, [user, isLoading, router]);

  const handleGoogleCredential = useCallback(
    async (response: { credential: string }) => {
      setLogging(true);
      setError('');
      try {
        const res = await api.post<{ accessToken: string; user: any }>('/auth/google', {
          idToken: response.credential,
        });

        if (res.user.role !== 'ADMIN') {
          setError('관리자 권한이 없습니다');
          setLogging(false);
          return;
        }

        login(res.accessToken, res.user);
        router.replace('/');
      } catch (err) {
        if (err instanceof ApiError) {
          setError(err.message);
        } else {
          setError('Google 로그인에 실패했습니다');
        }
        setLogging(false);
      }
    },
    [login, router],
  );

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => {
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleCredential,
      });
      window.google.accounts.id.renderButton(document.getElementById('google-login-btn'), {
        theme: 'outline',
        size: 'large',
        width: '100%',
        text: 'signin_with',
        locale: 'ko',
      });
    };
    document.head.appendChild(script);
  }, [handleGoogleCredential]);

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
    if (!window.Kakao) {
      setError('Kakao SDK가 로드되지 않았습니다');
      return;
    }

    window.Kakao.Auth.login({
      success: async (authObj: { access_token: string }) => {
        setLogging(true);
        setError('');
        try {
          const res = await api.post<{ accessToken: string; user: any }>('/auth/kakao', {
            accessToken: authObj.access_token,
          });

          if (res.user.role !== 'ADMIN') {
            setError('관리자 권한이 없습니다');
            setLogging(false);
            return;
          }

          login(res.accessToken, res.user);
          router.replace('/');
        } catch (err) {
          if (err instanceof ApiError) {
            setError(err.message);
          } else {
            setError('로그인에 실패했습니다');
          }
          setLogging(false);
        }
      },
      fail: () => {
        setError('카카오 로그인에 실패했습니다');
      },
    });
  };

  if (isLoading) return null;

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="w-full max-w-sm bg-white rounded-lg shadow-md p-8">
        <h1 className="text-2xl font-bold text-center mb-2">숲똑 Admin</h1>
        <p className="text-sm text-gray-500 text-center mb-8">관리자 로그인</p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded">{error}</div>
        )}

        {GOOGLE_CLIENT_ID && (
          <div className="mb-3">
            <div id="google-login-btn" className="w-full flex justify-center" />
          </div>
        )}

        {GOOGLE_CLIENT_ID && KAKAO_JS_KEY && (
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-white px-2 text-gray-500">또는</span>
            </div>
          </div>
        )}

        <button
          onClick={handleKakaoLogin}
          disabled={logging}
          className="w-full py-3 bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-medium rounded-lg transition-colors disabled:opacity-50"
        >
          {logging ? '로그인 중...' : '카카오로 로그인'}
        </button>
      </div>
    </div>
  );
}
