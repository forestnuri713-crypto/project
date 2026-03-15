'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

const NAV_ITEMS = [
  { href: '/', label: '대시보드', roles: ['ADMIN'] },
  { href: '/programs/pending', label: '프로그램 승인', roles: ['ADMIN'] },
  { href: '/instructors', label: '강사 관리', roles: ['ADMIN'] },
  { href: '/bulk-cancel', label: '일괄 취소', roles: ['ADMIN'] },
  { href: '/settlements', label: '정산', roles: ['ADMIN'] },
  { href: '/users', label: '유저 관리', roles: ['ADMIN'] },
  { href: '/providers', label: 'Provider', roles: ['ADMIN'] },
  { href: '/reviews', label: '리뷰 관리', roles: ['ADMIN'] },
  { href: '/my-programs', label: '내 프로그램', roles: ['INSTRUCTOR'] },
  { href: '/my-provider', label: '내 업체', roles: ['INSTRUCTOR'] },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const visibleItems = NAV_ITEMS.filter(
    (item) => user && item.roles.includes(user.role),
  );

  return (
    <aside className="w-60 bg-gray-900 text-gray-100 min-h-screen flex flex-col">
      <div className="px-6 py-5 border-b border-gray-700">
        <h1 className="text-lg font-bold tracking-tight">
          {user?.role === 'INSTRUCTOR' ? '숲똑 업체관리' : '숲똑 Admin'}
        </h1>
      </div>
      <nav className="flex-1 py-4">
        {visibleItems.map((item) => {
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
