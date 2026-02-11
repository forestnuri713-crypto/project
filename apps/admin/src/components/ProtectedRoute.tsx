'use client';

import { useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && (!user || user.role !== 'ADMIN')) {
      router.replace('/login');
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">로딩 중...</p>
      </div>
    );
  }

  if (!user || user.role !== 'ADMIN') {
    return null;
  }

  return <>{children}</>;
}
