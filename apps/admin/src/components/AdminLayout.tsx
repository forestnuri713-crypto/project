'use client';

import { ReactNode } from 'react';
import Sidebar from './Sidebar';
import ProtectedRoute from './ProtectedRoute';

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute>
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 bg-gray-50 p-8">{children}</main>
      </div>
    </ProtectedRoute>
  );
}
