"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useRealtimeList } from "@/hooks/useRealtimeList";
import { Permission } from "@/utils/permissions";
import { ROUTES } from "@/config/constants";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Loading } from "@/components/ui/Loading";

import { StatusBadge } from "@/components/ui/Badge";
import { ErrorState } from "@/components/ui/ErrorState";
import { Pagination } from "@/components/ui/Pagination";
import { RequestFilters } from "@/components/features/requests/RequestFilters";
import { usePagination } from "@/hooks/usePagination";
import { requestService } from "@/services/request-service";
import { formatCurrency, formatRelativeTime } from "@/utils/helpers";
import { analytics } from "@/utils/analytics";
import Link from "next/link";
import { Plus, User } from "lucide-react";
import { ProtectedRoute } from "@/components/shared/ProtectedRoute";
import { Skeleton } from "@/components/ui";

export default function RequestsPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const { page, limit, goToPage } = usePagination();
  const [filters, setFilters] = useState<Record<string, any>>({});

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push(ROUTES.LOGIN);
    }
  }, [isAuthenticated, authLoading, router]);

  useRealtimeList(["request:created", "request:updated", "request:deleted", "proposal:created", "proposal:deleted"], ["requests"]);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["requests", page, limit, filters],
    queryFn: () => requestService.getRequests({ page, limit, ...filters }),
  });

  useEffect(() => {
    analytics.pageview({
      path: "/requests",
      title: "Service Requests",
    });
  }, []);

  const handleFilterChange = (newFilters: Record<string, any>) => {
    setFilters(newFilters);
    goToPage(1); // Reset to first page on filter change
  };

  const handleClearFilters = () => {
    setFilters({});
    goToPage(1);
  };

  if (authLoading) {
    return <Loading />;
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <ProtectedRoute
      requiredPermissions={[
        Permission.REQUESTS_CREATE,
        Permission.REQUESTS_BROWSE,
      ]}
    >
      <Layout>
        <div className="container-custom py-12">
          {error ? (
            <ErrorState
              title="Failed to load requests"
              message="We couldn't load your service requests. Please try again."
              retry={() => refetch()}
            />
          ) : (
            <>
              <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 dark:text-white mb-1">
                    Service Requests
                  </h1>
                  <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
                    Browse and manage service requests
                  </p>
                </div>
                <Link href={ROUTES.CREATE_REQUEST}>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    New Request
                  </Button>
                </Link>
              </div>

              {/* Filters */}
              <RequestFilters
                onFilterChange={handleFilterChange}
                onClear={handleClearFilters}
                activeFilters={filters}
              />

              {/* Loading State with Skeletons */}
              {isLoading ? (
                <div className="grid gap-6">
                  {[...Array(5)].map((_, i) => (
                    <Card key={i}>
                      <CardContent>
                        <div className="space-y-3">
                          <Skeleton width="60%" height="24px" />
                          <Skeleton count={2} />
                          <div className="flex gap-4">
                            <Skeleton width="80px" />
                            <Skeleton width="100px" />
                            <Skeleton width="120px" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : data && Array.isArray(data.data) && data.data.length > 0 ? (
                <>
                  <div className="grid gap-6">
                    {data.data.map((request) => (
                      <Card key={request.id} hover>
                        <CardContent>
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2 mb-1">
                                {request.category && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300 border border-primary-200 dark:border-primary-700">
                                    {request.category.icon && (
                                      <span>{request.category.icon}</span>
                                    )}
                                    {request.category.name}
                                  </span>
                                )}
                              </div>
                              <Link href={`/requests/${request.id}`}>
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white hover:text-primary-600 dark:hover:text-primary-400 focus-visible:outline-none focus-visible:underline">
                                  Request #
                                  {request.display_id ||
                                    request.id.substring(0, 8)}
                                </h3>
                              </Link>
                              <p className="text-gray-600 dark:text-gray-400 mt-2 line-clamp-2 break-words">
                                {request.description}
                              </p>
                              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-4 text-sm text-gray-500 dark:text-gray-400">
                                <span className="font-medium text-gray-900 dark:text-white">
                                  {formatCurrency(request.budget)}
                                </span>
                                <span>•</span>
                                <span className="inline-flex items-center gap-1">
                                  <User className="h-3.5 w-3.5" />
                                  {request.user_id === user?.id
                                    ? "You"
                                    : request.user_name
                                      ?? `User #${(request.user_id ?? "unknown").substring(0, 8)}`}
                                </span>
                                <span>•</span>
                                <span>{formatRelativeTime(request.created_at)}</span>
                              </div>
                            </div>
                            <StatusBadge status={request.status} />
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  {data.total && data.total > limit ? (
                    <Pagination
                      currentPage={page}
                      totalPages={Math.ceil(data.total / limit)}
                      onPageChange={goToPage}
                    />
                  ) : null}
                </>
              ) : (
                <Card>
                  <CardContent>
                    <div className="text-center py-12">
                      <p className="text-gray-500 dark:text-gray-400 mb-4">
                        No requests found
                      </p>
                      <Link href={ROUTES.CREATE_REQUEST}>
                        <Button>Create Your First Request</Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
