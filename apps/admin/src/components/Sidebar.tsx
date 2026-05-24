'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

interface NavItem {
  href: string;
  label: string;
  children?: { href: string; label: string }[];
}

const NAV_ITEMS: NavItem[] = [
  { href: '/', label: '대시보드' },
  {
    href: '/programs',
    label: '프로그램',
    children: [
      { href: '/programs/create', label: '프로그램 등록' },
    ],
  },
  { href: '/reservations', label: '예약 관리' },
  { href: '/users', label: '사용자 관리' },
];

const EXTRA_NAV_ITEMS: NavItem[] = [
  { href: '/programs/pending', label: '프로그램 승인 (구)' },
  { href: '/instructors', label: '강사 관리' },
  { href: '/settlements', label: '정산' },
  { href: '/reviews', label: '리뷰' },
  { href: '/providers', label: '업체' },
  { href: '/bulk-cancel', label: '일괄 취소' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { signOut, logout } = useAuth();

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  const handleLogout = async () => {
    await signOut();
    logout();
  };

  return (
    <aside className="w-60 bg-gray-900 text-gray-100 min-h-screen flex flex-col">
      <div className="px-6 py-5 border-b border-gray-700">
        <h1 className="text-lg font-bold tracking-tight">숲똑 Admin</h1>
      </div>
      <nav className="flex-1 py-4">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.href);
          return (
            <div key={item.href}>
              <Link
                href={item.href}
                className={`block px-6 py-2.5 text-sm transition-colors ${
                  active
                    ? 'bg-gray-800 text-white font-medium'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
              >
                {item.label}
              </Link>
              {item.children?.map((child) => {
                const childActive = isActive(child.href);
                return (
                  <Link
                    key={child.href}
                    href={child.href}
                    className={`block pl-10 pr-6 py-2 text-xs transition-colors ${
                      childActive
                        ? 'bg-gray-800 text-white font-medium'
                        : 'text-gray-500 hover:text-white hover:bg-gray-800'
                    }`}
                  >
                    └ {child.label}
                  </Link>
                );
              })}
            </div>
          );
        })}

        <div className="mt-4 mx-4 border-t border-gray-700 pt-4">
          <p className="px-2 text-xs text-gray-600 mb-2">기존 메뉴</p>
          {EXTRA_NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`block px-2 py-1.5 text-xs transition-colors rounded ${
                isActive(item.href)
                  ? 'bg-gray-800 text-gray-300'
                  : 'text-gray-600 hover:text-gray-400 hover:bg-gray-800'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </nav>
      <div className="px-6 py-4 border-t border-gray-700">
        <button
          onClick={handleLogout}
          className="text-sm text-gray-400 hover:text-white transition-colors"
        >
          로그아웃
        </button>
      </div>
    </aside>
  );
}
