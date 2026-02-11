import type { Metadata } from 'next';
import { AuthProvider } from '@/contexts/AuthContext';
import './globals.css';

export const metadata: Metadata = {
  title: '숲똑 관리자',
  description: '숲체험 예약 플랫폼 숲똑 - 강사/관리자 페이지',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
