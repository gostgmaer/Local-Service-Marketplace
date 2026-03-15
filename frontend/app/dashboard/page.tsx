'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { ROUTES } from '@/config/constants';
import { Loading } from '@/components/ui/Loading';
import { analytics } from '@/utils/analytics';
// Role-based dashboard components
import CustomerDashboard from '@/components/dashboard/CustomerDashboard';
import ProviderDashboard from '@/components/dashboard/ProviderDashboard';

export default function DashboardPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push(ROUTES.LOGIN);
    }
  }, [isAuthenticated, authLoading, router]);

  useEffect(() => {
    if (isAuthenticated) {
      analytics.pageview({
        path: '/dashboard',
        title: `${user?.role === 'provider' ? 'Provider' : 'Customer'} Dashboard`,
      });
    }
  }, [isAuthenticated, user?.role]);

  if (authLoading) {
    return <Loading />;
  }

  if (!isAuthenticated) {
    return null;
  }

  // Role-based dashboard rendering
  const isProvider = user?.role === 'provider';

  return isProvider ? <ProviderDashboard /> : <CustomerDashboard />;
}
