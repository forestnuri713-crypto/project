import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '숲똑',
  description: '숲체험 예약 플랫폼 숲똑',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
