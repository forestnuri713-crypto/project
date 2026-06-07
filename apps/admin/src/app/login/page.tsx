'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

export default function LoginPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  useEffect(() => {
    if (!isLoading && user) {
      router.replace('/');
    }
  }, [user, isLoading, router]);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error || !data.session) {
      setLoginError(error?.message ?? '로그인에 실패했습니다');
      setLoginLoading(false);
      return;
    }

    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', data.session.user.id)
      .maybeSingle();

    if (!profile || (profile.role !== 'super_admin' && profile.role !== 'operator')) {
      await supabase.auth.signOut();
      setLoginError('관리자 권한이 없습니다');
      setLoginLoading(false);
      return;
    }

    router.replace('/');
  };

  if (isLoading) return null;

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="w-full max-w-sm bg-white rounded-lg shadow-md p-8">
        <h1 className="text-2xl font-bold text-center mb-2">숲똑 Admin</h1>
        <p className="text-sm text-gray-500 text-center mb-8">관리자 로그인</p>

        {loginError && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded">{loginError}</div>
        )}

        <form onSubmit={handleEmailLogin} className="space-y-4">
          <input
            type="email"
            placeholder="이메일"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
          />
          <input
            type="password"
            placeholder="비밀번호"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
          />
          <button
            type="submit"
            disabled={loginLoading}
            className="w-full py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
          >
            {loginLoading ? '로그인 중...' : '로그인'}
          </button>
        </form>

        {/*
          카카오 로그인은 Supabase Auth 전환 중 임시 비활성화.
          - Supabase는 카카오를 기본 OAuth 프로바이더로 지원하지 않음
          - 추후 커스텀 OIDC 또는 별도 인증 흐름으로 재도입 예정
        */}
      </div>
    </div>
  );
}
