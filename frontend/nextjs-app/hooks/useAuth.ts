'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';

export function useAuth() {
  const router = useRouter();
  const {
    user,
    token,
    isAuthenticated,
    isLoading,
    login,
    signup,
    logout,
    checkAuth,
  } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const requireAuth = () => {
    if (!isAuthenticated && !isLoading) {
      router.push('/login');
    }
  };

  const requireRole = (roles: string[]) => {
    if (!isAuthenticated || !user) {
      router.push('/login');
      return false;
    }
    if (!roles.includes(user.role)) {
      router.push('/dashboard');
      return false;
    }
    return true;
  };

  return {
    user,
    token,
    isAuthenticated,
    isLoading,
    login,
    signup,
    logout,
    requireAuth,
    requireRole,
  };
}
