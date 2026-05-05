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
    href: '/programs/new',
    label: '프로그램 등록',
    children: [{ href: '/guide-templates', label: '안내 템플릿' }],
  },
  { href: '/programs/pending', label: '프로그램 승인' },
  { href: '/instructors', label: '강사 관리' },
  { href: '/bulk-cancel', label: '일괄 취소' },
  { href: '/settlements', label: '정산' },
  { href: '/users', label: '유저 관리' },
  { href: '/providers', label: 'Provider' },
  { href: '/reviews', label: '리뷰 관리' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { logout } = useAuth();

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

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
