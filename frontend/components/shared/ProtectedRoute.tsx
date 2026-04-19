"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { ROUTES } from "@/config/constants";
import { Loading } from "@/components/ui/Loading";

type Role = "customer" | "provider" | "admin";
interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAuth?: boolean;
  /** @deprecated Use requiredPermissions instead */
  requiredRoles?: Role[];
  /** User must have at least one of these permissions */
  requiredPermissions?: string[];
  redirectTo?: string;
}

export function ProtectedRoute({
  children,
  requireAuth = true,
  requiredRoles,
  requiredPermissions,
  redirectTo = ROUTES.LOGIN,
}: ProtectedRouteProps) {
  const router = useRouter();
  const { isAuthenticated, user, isLoading, updateSession } = useAuth();
  const { canAny } = usePermissions();
  const [isAuthorized, setIsAuthorized] = useState(false);

  // When a page is restored from the browser's back-forward cache (bfcache)
  // the React context still holds the previous session state. Force a session
  // re-validation so stale "authenticated" state is cleared after logout.
  useEffect(() => {
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        setIsAuthorized(false);
        updateSession();
      }
    };
    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, [updateSession]);

  useEffect(() => {
    if (isLoading) return;

    // Check authentication
    if (requireAuth && !isAuthenticated) {
      router.push(redirectTo);
      return;
    }

    // Prefer permission-based check
    if (requiredPermissions && requiredPermissions.length > 0) {
      if (!canAny(requiredPermissions)) {
        router.push(ROUTES.DASHBOARD);
        return;
      }
    }
    // Fallback: legacy role-based check
    else if (requiredRoles && requiredRoles.length > 0) {
      if (!user?.role || !requiredRoles.includes(user.role as Role)) {
        router.push(ROUTES.DASHBOARD);
        return;
      }
    }

    setIsAuthorized(true);
  }, [
    isAuthenticated,
    user,
    isLoading,
    requireAuth,
    requiredRoles,
    requiredPermissions,
    canAny,
    router,
    redirectTo,
  ]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loading />
      </div>
    );
  }

  if (!isAuthorized) {
    return null;
  }

  return <>{children}</>;
}
