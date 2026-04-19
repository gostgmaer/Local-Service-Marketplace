"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { Permission } from "@/utils/permissions";
import { ROUTES } from "@/config/constants";
import { Loading } from "@/components/ui/Loading";
import { analytics } from "@/utils/analytics";
import { useQuery } from "@tanstack/react-query";
import { getProviderProfileByUserId } from "@/services/user-service";

const CustomerDashboard = dynamic(
  () => import("@/components/dashboard/CustomerDashboard"),
  {
    loading: () => <Loading />,
  },
);
const ProviderDashboard = dynamic(
  () => import("@/components/dashboard/ProviderDashboard"),
  {
    loading: () => <Loading />,
  },
);

export default function DashboardPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { can } = usePermissions();
  const isProvider = can(Permission.PROVIDER_PROFILE_VIEW);
  const isAdmin = can(Permission.ADMIN_ACCESS);

  const { data: provider, isLoading: providerLoading } = useQuery({
    queryKey: ["my-provider-profile", user?.id],
    queryFn: () => getProviderProfileByUserId(user!.id),
    enabled: isAuthenticated && isProvider && !!user?.id,
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push(ROUTES.LOGIN);
    }
  }, [isAuthenticated, authLoading, router]);

  useEffect(() => {
    if (
      isAuthenticated &&
      isProvider &&
      !providerLoading &&
      provider === null
    ) {
      router.replace(ROUTES.ONBOARDING);
    }
  }, [isAuthenticated, isProvider, provider, providerLoading, router]);

  useEffect(() => {
    if (isAuthenticated && user?.role) {
      if (isAdmin) {
        router.replace(ROUTES.DASHBOARD_ADMIN);
      }
      analytics.pageview({
        path: "/dashboard",
        title: `${
          isAdmin ? "Admin" : isProvider ? "Provider" : "Customer"
        } Dashboard`,
      });
    }
  }, [isAuthenticated, user?.role, isAdmin, isProvider, router]);

  if (authLoading || (isProvider && providerLoading)) {
    return <Loading />;
  }

  if (!isAuthenticated) return null;

  if (isProvider) {
    return <ProviderDashboard />;
  }

  return <CustomerDashboard />;
}
