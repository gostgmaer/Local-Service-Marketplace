"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { Permission } from "@/utils/permissions";
import { useRealtimeList } from "@/hooks/useRealtimeList";
import { ROUTES } from "@/config/constants";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Loading } from "@/components/ui/Loading";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { StatusBadge } from "@/components/ui/Badge";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { jobService } from "@/services/job-service";
import { formatRelativeTime, formatDateTime } from "@/utils/helpers";
import Link from "next/link";
import { Briefcase, Star, CheckCircle, Search, ChevronLeft, ChevronRight } from "lucide-react";

const STATUS_FILTERS = [
  { value: "", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "in_progress", label: "Active" },
  { value: "scheduled", label: "Scheduled" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "disputed", label: "Disputed" },
];

const SORT_OPTIONS = [
  { value: "created_at:desc", label: "Newest First" },
  { value: "created_at:asc", label: "Oldest First" },
  { value: "status:asc", label: "By Status" },
];

const PAGE_SIZE = 10;

export default function JobsPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { can } = usePermissions();

  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [sortValue, setSortValue] = useState("created_at:desc");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push(ROUTES.LOGIN);
    } else if (!authLoading && isAuthenticated && !can(Permission.JOBS_READ)) {
      router.push(ROUTES.DASHBOARD);
    }
  }, [isAuthenticated, authLoading, router, can]);

  useRealtimeList(["job:created", "job:updated", "job:completed", "job:deleted"], ["my-jobs-page"]);

  const [sort_by, sort_order] = sortValue.split(":") as [string, "asc" | "desc"];

  const { data: result, isLoading, error, refetch } = useQuery({
    queryKey: ["my-jobs-page", page, statusFilter, sort_by, sort_order, search],
    queryFn: () => jobService.getMyJobs({
      page,
      limit: PAGE_SIZE,
      ...(statusFilter ? { status: statusFilter } : {}),
      sort_by,
      sort_order,
      ...(search ? { search } : {}),
    }),
    enabled: isAuthenticated,
  });

  // Stats: one query per notable status
  const { data: activeStats } = useQuery({
    queryKey: ["my-jobs-stats", "active"],
    queryFn: () => jobService.getMyJobs({ page: 1, limit: 1, status: "in_progress,scheduled,pending" }),
    enabled: isAuthenticated,
  });
  const { data: completedStats } = useQuery({
    queryKey: ["my-jobs-stats", "completed"],
    queryFn: () => jobService.getMyJobs({ page: 1, limit: 1, status: "completed" }),
    enabled: isAuthenticated,
  });
  const { data: cancelledStats } = useQuery({
    queryKey: ["my-jobs-stats", "cancelled"],
    queryFn: () => jobService.getMyJobs({ page: 1, limit: 1, status: "cancelled" }),
    enabled: isAuthenticated,
  });

  if (authLoading) return <Loading />;
  if (!isAuthenticated) return null;

  const jobs = result?.data ?? [];
  const total = result?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const handleSearch = () => {
    setSearch(searchInput);
    setPage(1);
  };

  const handleStatusChange = (status: string) => {
    setStatusFilter(status);
    setPage(1);
  };

  return (
    <Layout>
      <div className="container-custom py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Jobs</h1>
            <p className="mt-1 text-gray-600 dark:text-gray-400">Manage your active and completed jobs</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <Card className="border-l-4 border-l-blue-500">
            <CardContent className="p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Active</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{activeStats?.total ?? "—"}</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-green-500">
            <CardContent className="p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Completed</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{completedStats?.total ?? "—"}</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-red-400">
            <CardContent className="p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Cancelled</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{cancelledStats?.total ?? "—"}</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="flex gap-2 flex-1 flex-wrap">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => handleStatusChange(f.value)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  statusFilter === f.value
                    ? "bg-primary-600 text-white"
                    : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <select
              value={sortValue}
              onChange={(e) => { setSortValue(e.target.value); setPage(1); }}
              className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300"
            >
              {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>

        {/* Search */}
        <div className="flex gap-2 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search jobs..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <Button size="sm" onClick={handleSearch}>Search</Button>
          {(search || statusFilter) && (
            <Button size="sm" variant="outline" onClick={() => { setSearch(""); setSearchInput(""); setStatusFilter(""); setPage(1); }}>Clear</Button>
          )}
        </div>

        {isLoading ? (
          <div className="grid gap-6">
            {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : error ? (
          <ErrorState title="Failed to load jobs" message="We couldn't load your jobs. Please try again." retry={() => refetch()} />
        ) : jobs.length > 0 ? (
          <>
            <div className="grid gap-4">
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
                            <span><span className="font-medium text-gray-700 dark:text-gray-300">Provider:</span> {job.provider_name || job.provider?.name || "N/A"}</span>
                            <span>•</span>
                            <span><span className="font-medium text-gray-700 dark:text-gray-300">Customer:</span> {job.customer_name || job.customer?.name || "N/A"}</span>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                            <span>Created {formatRelativeTime(job.created_at)}</span>
                            {job.started_at && (<><span>•</span><span>Started {formatDateTime(job.started_at)}</span></>)}
                            {job.completed_at && (<><span>•</span><span className="flex items-center gap-1 text-green-600 dark:text-green-400"><CheckCircle className="h-3.5 w-3.5" />Completed {formatDateTime(job.completed_at)}</span></>)}
                          </div>
                          {(job as any).provider_rating != null && job.status === "completed" && (
                            <div className="flex items-center gap-1 text-sm text-amber-500">
                              <Star className="h-3.5 w-3.5 fill-amber-400" />
                              <span className="font-medium">{(Number((job as any).provider_rating) || 0).toFixed(1)}</span>
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
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                <p className="text-sm text-gray-500">Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}</p>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm text-gray-600 dark:text-gray-400 px-2">{page} / {totalPages}</span>
                  <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        ) : (
          <EmptyState
            title="No jobs found"
            description={search || statusFilter ? "Try adjusting your filters." : "Jobs will appear here once your proposals are accepted."}
            icon="inbox"
            action={!search && !statusFilter ? { label: "Browse Requests", onClick: () => router.push(ROUTES.DASHBOARD_BROWSE_REQUESTS) } : undefined}
          />
        )}
      </div>
    </Layout>
  );
}
