'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function LoginPage() {
  const { user, isLoading, signIn } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isLoading && user) {
      router.replace('/');
    }
  }, [user, isLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error: err } = await signIn(email, password);
    if (err) {
      setError(err);
      setLoading(false);
    }
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

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            placeholder="이메일"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
          />
          <input
            type="password"
            placeholder="비밀번호"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white font-medium rounded-lg transition-colors"
          >
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </form>
      </div>
    </div>
  );
}
