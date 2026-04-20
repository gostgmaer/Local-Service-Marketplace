"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useRealtimeList } from "@/hooks/useRealtimeList";
import { ROUTES } from "@/config/constants";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent } from "@/components/ui/Card";
import { Loading } from "@/components/ui/Loading";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { StatusBadge } from "@/components/ui/Badge";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { jobService } from "@/services/job-service";
import { formatDate, formatRelativeTime, formatDateTime } from "@/utils/helpers";
import Link from "next/link";
import { Briefcase, Star, CheckCircle } from "lucide-react";

export default function JobsPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push(ROUTES.LOGIN);
    }
  }, [isAuthenticated, authLoading, router]);

  useRealtimeList(["job:created", "job:updated", "job:completed", "job:deleted"], ["my-jobs"]);

  const {
    data: jobs,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["my-jobs"],
    queryFn: () => jobService.getMyJobs(),
    enabled: isAuthenticated,
  });

  if (authLoading) {
    return <Loading />;
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <Layout>
      <div className="container-custom py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Jobs
            </h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              Manage your active and completed jobs
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="grid gap-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : error ? (
          <ErrorState
            title="Failed to load jobs"
            message="We couldn't load your jobs. Please try again."
            retry={() => refetch()}
          />
        ) : jobs && jobs.length > 0 ? (
          <div className="grid gap-6">
            {jobs.map((job) => (
              <Card key={job.id} hover>
                <CardContent>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <Link href={ROUTES.DASHBOARD_JOB_DETAIL(job.id)}>
                        <div className="flex items-center gap-3">
                          <Briefcase className="h-5 w-5 text-gray-400" />
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white hover:text-primary-600 dark:hover:text-primary-400">
                            Job #{job.display_id || job.id.slice(0, 8)}
                          </h3>
                        </div>
                      </Link>
                      <div className="mt-3 space-y-2">
                        <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                          <span>
                            <span className="font-medium text-gray-700 dark:text-gray-300">
                              Provider:
                            </span>{" "}
                            {job.provider_name || job.provider?.name || "N/A"}
                          </span>
                          <span>•</span>
                          <span>
                            <span className="font-medium text-gray-700 dark:text-gray-300">
                              Customer:
                            </span>{" "}
                            {job.customer_name || job.customer?.name || "N/A"}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                          <span>Created {formatRelativeTime(job.created_at)}</span>
                          {job.started_at && (
                            <>
                              <span>•</span>
                              <span>Started {formatDateTime(job.started_at)}</span>
                            </>
                          )}
                          {job.completed_at && (
                            <>
                              <span>•</span>
                              <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                                <CheckCircle className="h-3.5 w-3.5" />
                                Completed {formatDateTime(job.completed_at)}
                              </span>
                            </>
                          )}
                        </div>
                        {(job as any).provider_rating != null && job.status === "completed" && (
                          <div className="flex items-center gap-1 text-sm text-amber-500">
                            <Star className="h-3.5 w-3.5 fill-amber-400" />
                            <span className="font-medium">{Number((job as any).provider_rating).toFixed(1)}</span>
                            <span className="text-gray-400 text-xs">provider rating</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <StatusBadge status={job.status} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No jobs yet"
            description="Jobs will appear here once your proposals are accepted."
            icon="inbox"
            action={{
              label: "Browse Requests",
              onClick: () => router.push(ROUTES.DASHBOARD_BROWSE_REQUESTS),
            }}
          />
        )}
      </div>
    </Layout>
  );
}
