'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

type AdminRole = 'super_admin' | 'operator';

interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
}

interface AuthContextType {
  user: AdminUser | null;
  session: Session | null;
  isLoading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  isLoading: true,
  logout: async () => {},
});

async function fetchAdminProfile(userId: string): Promise<AdminUser | null> {
  const { data, error } = await supabase
    .from('users')
    .select('id, email, name, role')
    .eq('id', userId)
    .maybeSingle();

  if (error || !data) return null;
  if (data.role !== 'super_admin' && data.role !== 'operator') return null;

  return data as AdminUser;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    supabase.auth.getSession().then(async ({ data }) => {
      if (cancelled) return;
      setSession(data.session);
      if (data.session) {
        setUser(await fetchAdminProfile(data.session.user.id));
      }
      setIsLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession ? await fetchAdminProfile(nextSession.user.id) : null);
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  return (
    <AuthContext.Provider value={{ user, session, isLoading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
