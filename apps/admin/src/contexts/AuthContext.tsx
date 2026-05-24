'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import type { UserRole } from '@/types';

interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

interface AuthContextType {
  user: AdminUser | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  // legacy compat for existing NestJS pages
  token: string | null;
  login: (token: string, user: any) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  signIn: async () => ({ error: null }),
  signOut: async () => {},
  token: null,
  login: () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadUserProfile = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from('users')
      .select('id, email, name, role')
      .eq('id', userId)
      .single();
    return data as AdminUser | null;
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const profile = await loadUserProfile(session.user.id);
        if (profile && (profile.role === 'super_admin' || profile.role === 'operator')) {
          setUser(profile);
          setToken(session.access_token);
        }
      }
      setIsLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        const profile = await loadUserProfile(session.user.id);
        if (profile && (profile.role === 'super_admin' || profile.role === 'operator')) {
          setUser(profile);
          setToken(session.access_token);
        }
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setToken(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [loadUserProfile]);

  const signIn = useCallback(async (email: string, password: string): Promise<{ error: string | null }> => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };

    const profile = await loadUserProfile(data.user.id);
    if (!profile) return { error: '사용자 정보를 찾을 수 없습니다' };
    if (profile.role !== 'super_admin' && profile.role !== 'operator') {
      await supabase.auth.signOut();
      return { error: '관리자 권한이 없습니다' };
    }
    return { error: null };
  }, [loadUserProfile]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  // Legacy compat
  const login = useCallback((newToken: string, newUser: any) => {
    setToken(newToken);
    setUser(newUser);
  }, []);
  const logout = useCallback(async () => {
    await signOut();
  }, [signOut]);

  return (
    <AuthContext.Provider value={{ user, isLoading, signIn, signOut, token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
