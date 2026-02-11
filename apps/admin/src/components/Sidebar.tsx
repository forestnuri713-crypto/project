'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

const NAV_ITEMS = [
  { href: '/', label: '대시보드' },
  { href: '/programs/pending', label: '프로그램 승인' },
  { href: '/settlements', label: '정산' },
  { href: '/users', label: '유저 관리' },
  { href: '/providers', label: 'Provider' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { logout } = useAuth();

  return (
    <aside className="w-60 bg-gray-900 text-gray-100 min-h-screen flex flex-col">
      <div className="px-6 py-5 border-b border-gray-700">
        <h1 className="text-lg font-bold tracking-tight">숲똑 Admin</h1>
      </div>
      <nav className="flex-1 py-4">
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.href === '/'
              ? pathname === '/'
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`block px-6 py-2.5 text-sm transition-colors ${
                isActive
                  ? 'bg-gray-800 text-white font-medium'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="px-6 py-4 border-t border-gray-700">
        <button
          onClick={logout}
          className="text-sm text-gray-400 hover:text-white transition-colors"
        >
          로그아웃
        </button>
      </div>
    </aside>
  );
}
