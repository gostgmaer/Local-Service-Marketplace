"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useRealtimeList } from "@/hooks/useRealtimeList";
import { ROUTES } from "@/config/constants";
import { Layout } from "@/components/layout/Layout";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/Badge";
import { ErrorState } from "@/components/ui/ErrorState";
import { SkeletonStatCard, SkeletonListItem } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { getProviderProfileByUserId } from "@/services/user-service";
import { proposalService } from "@/services/proposal-service";
import { jobService } from "@/services/job-service";
import { paymentService } from "@/services/payment-service";
import { formatRelativeTime, formatCurrency } from "@/utils/helpers";
import Link from "next/link";
import {
  Briefcase,
  FileText,
  IndianRupee,
  Search,
  Calendar,
  TrendingUp,
  User,
  Star,
  ImageIcon,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

const JOBS_PER_PAGE = 5;
const PROPOSALS_PER_PAGE = 5;

export default function ProviderDashboard() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();

  const [jobsPage, setJobsPage] = useState(1);
  const [proposalsPage, setProposalsPage] = useState(1);

  useRealtimeList(["proposal:created", "proposal:accepted", "proposal:rejected", "proposal:updated", "proposal:withdrawn", "proposal:deleted"], ["my-proposals-dashboard"]);
  useRealtimeList(["job:created", "job:updated", "job:completed"], ["my-jobs-dashboard"]);

  // Only fetch ACTIVE jobs (in_progress + scheduled + pending) with pagination
  const {
    data: jobsResult,
    isLoading: jobsLoading,
    error: jobsError,
    refetch: refetchJobs,
  } = useQuery({
    queryKey: ["my-jobs-dashboard", jobsPage],
    queryFn: () =>
      jobService.getMyJobs({
        page: jobsPage,
        limit: JOBS_PER_PAGE,
        status: "in_progress,scheduled,pending",
        sort_by: "created_at",
        sort_order: "desc",
      }),
    enabled: isAuthenticated,
  });

  // Fetch recent proposals with pagination
  const {
    data: proposalsResult,
    isLoading: proposalsLoading,
    error: proposalsError,
    refetch: refetchProposals,
  } = useQuery({
    queryKey: ["my-proposals-dashboard", proposalsPage],
    queryFn: () =>
      proposalService.getMyProposals({
        page: proposalsPage,
        limit: PROPOSALS_PER_PAGE,
        sort_by: "created_at",
        sort_order: "desc",
      }),
    enabled: isAuthenticated,
  });

  // Fetch provider profile to get provider ID for earnings
  const { data: providerProfile } = useQuery({
    queryKey: ["my-provider-profile-id", user?.id],
    queryFn: () => getProviderProfileByUserId(user!.id),
    enabled: isAuthenticated && !!user?.id,
  });

  // Fetch earnings summary from payment service
  const { data: earningsSummary, isLoading: earningsLoading } = useQuery({
    queryKey: ["provider-earnings-summary", providerProfile?.id],
    queryFn: () => paymentService.getProviderEarnings(providerProfile!.id),
    enabled: isAuthenticated && !!providerProfile?.id,
  });

  if (proposalsError || jobsError) {
    return (
      <Layout>
        <div className="container-custom py-12">
          <ErrorState
            title="Failed to load dashboard"
            message="We couldn't load your dashboard data. Please try again."
            retry={() => {
              refetchProposals();
              refetchJobs();
            }}
          />
        </div>
      </Layout>
    );
  }

  const activeJobsList = jobsResult?.data ?? [];
  const jobsTotal = jobsResult?.total ?? 0;
  const jobsTotalPages = Math.ceil(jobsTotal / JOBS_PER_PAGE);

  const proposalList = proposalsResult?.data ?? [];
  const proposalsTotal = proposalsResult?.total ?? 0;
  const proposalsTotalPages = Math.ceil(proposalsTotal / PROPOSALS_PER_PAGE);

  // Stat values - from earnings API or fallback to 0
  const totalEarnings = earningsSummary?.summary?.total_earnings ?? 0;
  const pendingPayout = earningsSummary?.summary?.pending_payout ?? 0;
  const completedCount = earningsSummary?.summary?.completed_count ?? 0;
  const activeJobsCount = jobsTotal;
  const pendingProposals = proposalList.filter((p: any) => p.status === "pending").length;

  // Success rate: if earnings available use completed_count vs total proposals; else compute from loaded proposals
  const acceptedProposalsInView = proposalList.filter((p: any) => p.status === "accepted").length;

  const successRate =
    proposalsTotal > 0
      ? Math.round(((earningsSummary?.summary?.completed_count ?? acceptedProposalsInView) / proposalsTotal) * 100)
      : 0;

  return (
    <Layout>
      <div className="container-custom py-12">
        {/* Welcome Section */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-white mb-3">
            Welcome back, {user?.name || user?.email}!
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            Manage your service business and grow your income
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 mb-10">
          {earningsLoading ? (
            <SkeletonStatCard />
          ) : (
            <Card hover className="animate-fade-in">
              <CardContent className="flex items-center justify-between p-6">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Total Earnings
                  </p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                    {formatCurrency(totalEarnings)}
                  </p>
                </div>
                <div className="h-12 w-12 rounded-2xl bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center flex-shrink-0">
                  <IndianRupee className="h-6 w-6 text-primary-600 dark:text-primary-400" />
                </div>
              </CardContent>
            </Card>
          )}

          {jobsLoading ? (
            <SkeletonStatCard />
          ) : (
            <Card hover className="animate-fade-in">
              <CardContent className="flex items-center justify-between p-6">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Active Jobs
                  </p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                    {activeJobsCount}
                  </p>
                </div>
                <div className="h-12 w-12 rounded-2xl bg-green-50 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                  <Briefcase className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
              </CardContent>
            </Card>
          )}

          {earningsLoading ? (
            <SkeletonStatCard />
          ) : (
            <Card hover className="animate-fade-in">
              <CardContent className="flex items-center justify-between p-6">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Pending Payout
                  </p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                    {formatCurrency(pendingPayout)}
                  </p>
                </div>
                <div className="h-12 w-12 rounded-2xl bg-yellow-50 dark:bg-yellow-900/30 flex items-center justify-center flex-shrink-0">
                  <IndianRupee className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
                </div>
              </CardContent>
            </Card>
          )}

          {earningsLoading || proposalsLoading ? (
            <SkeletonStatCard />
          ) : (
            <Card hover className="animate-fade-in">
              <CardContent className="flex items-center justify-between p-6">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Success Rate
                  </p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                    {successRate}%
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    {completedCount} completed
                  </p>
                </div>
                <div className="h-12 w-12 rounded-2xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                  <TrendingUp className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Quick Actions */}
        <Card className="mb-8">
          <CardHeader>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Quick Actions
            </h2>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Link href={ROUTES.DASHBOARD_BROWSE_REQUESTS}>
                <Button variant="outline" className="w-full justify-start">
                  <Search className="h-4 w-4 mr-2" />
                  Browse Service Requests
                </Button>
              </Link>
              <Link href={ROUTES.DASHBOARD_MY_PROPOSALS}>
                <Button variant="outline" className="w-full justify-start">
                  <FileText className="h-4 w-4 mr-2" />
                  View My Proposals
                </Button>
              </Link>
              <Link href={ROUTES.DASHBOARD_AVAILABILITY}>
                <Button variant="outline" className="w-full justify-start">
                  <Calendar className="h-4 w-4 mr-2" />
                  Set Availability
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Provider Profile Management */}
        <Card className="mb-8">
          <CardHeader>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Profile Management
            </h2>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Link href={ROUTES.DASHBOARD_PROVIDER_OVERVIEW}>
                <Button variant="outline" className="w-full justify-start">
                  <User className="h-4 w-4 mr-2" />
                  Overview
                </Button>
              </Link>
              <Link href={ROUTES.DASHBOARD_PROVIDER_PORTFOLIO}>
                <Button variant="outline" className="w-full justify-start">
                  <ImageIcon className="h-4 w-4 mr-2" />
                  Portfolio
                </Button>
              </Link>
              <Link href={ROUTES.DASHBOARD_PROVIDER_REVIEWS}>
                <Button variant="outline" className="w-full justify-start">
                  <Star className="h-4 w-4 mr-2" />
                  Reviews
                </Button>
              </Link>
              <Link href={ROUTES.DASHBOARD_PROVIDER_DOCUMENTS}>
                <Button variant="outline" className="w-full justify-start">
                  <FileText className="h-4 w-4 mr-2" />
                  Documents
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Recent Proposals */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Recent Proposals
                  {proposalsTotal > 0 && (
                    <span className="ml-2 text-sm font-normal text-gray-500">
                      ({proposalsTotal} total)
                    </span>
                  )}
                </h2>
                <Link href={ROUTES.DASHBOARD_MY_PROPOSALS}>
                  <Button variant="outline" size="sm">
                    View All
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {proposalsLoading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <SkeletonListItem key={i} />
                  ))}
                </div>
              ) : proposalList.length > 0 ? (
                <>
                  <div className="space-y-3">
                    {proposalList.map((proposal: any) => (
                      <div
                        key={proposal.id}
                        className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 hover:border-blue-200 dark:hover:border-blue-700 transition-all"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-gray-900 dark:text-white truncate">
                              Proposal #
                              {proposal.display_id || proposal.id.substring(0, 8)}
                            </h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                              {proposal.message}
                            </p>
                            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5">
                              {formatCurrency(proposal.price)} &bull;{" "}
                              {formatRelativeTime(proposal.created_at)}
                            </p>
                          </div>
                          <StatusBadge status={proposal.status} />
                        </div>
                      </div>
                    ))}
                  </div>
                  {proposalsTotalPages > 1 && (
                    <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setProposalsPage((p) => Math.max(1, p - 1))}
                        disabled={proposalsPage === 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="text-sm text-gray-500">
                        {proposalsPage} / {proposalsTotalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setProposalsPage((p) => Math.min(proposalsTotalPages, p + 1))}
                        disabled={proposalsPage === proposalsTotalPages}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </>
              ) : (
                <EmptyState
                  title="No proposals yet"
                  description="Browse open service requests and submit your first proposal."
                  icon="search"
                  action={{
                    label: "Browse Requests",
                    onClick: () =>
                      router.push(ROUTES.DASHBOARD_BROWSE_REQUESTS),
                  }}
                />
              )}
            </CardContent>
          </Card>

          {/* Active Jobs */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Active Jobs
                  {jobsTotal > 0 && (
                    <span className="ml-2 text-sm font-normal text-gray-500">
                      ({jobsTotal} total)
                    </span>
                  )}
                </h2>
                <Link href={ROUTES.DASHBOARD_JOBS}>
                  <Button variant="outline" size="sm">
                    View All
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {jobsLoading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <SkeletonListItem key={i} />
                  ))}
                </div>
              ) : activeJobsList.length > 0 ? (
                <>
                  <div className="space-y-3">
                    {activeJobsList.map((job: any) => (
                      <Link
                        key={job.id}
                        href={ROUTES.DASHBOARD_JOB_DETAIL(job.id)}
                        className="block p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 hover:border-primary-200 dark:hover:border-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 transition-all"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-gray-900 dark:text-white truncate">
                              Job #{job.display_id || job.id.slice(0, 8)}
                            </h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                              {job.customer_name || job.customer?.name || "Customer"}
                            </p>
                            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5">
                              {formatCurrency(Number(job.actual_amount ?? job.proposal_price) || 0)} &bull;{" "}
                              {formatRelativeTime(job.created_at)}
                            </p>
                          </div>
                          <StatusBadge status={job.status} />
                        </div>
                      </Link>
                    ))}
                  </div>
                  {jobsTotalPages > 1 && (
                    <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setJobsPage((p) => Math.max(1, p - 1))}
                        disabled={jobsPage === 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="text-sm text-gray-500">
                        {jobsPage} / {jobsTotalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setJobsPage((p) => Math.min(jobsTotalPages, p + 1))}
                        disabled={jobsPage === jobsTotalPages}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </>
              ) : (
                <EmptyState
                  title="No active jobs"
                  description="Accepted proposals will show here as active jobs."
                  icon="inbox"
                  action={{
                    label: "Browse Requests",
                    onClick: () =>
                      router.push(ROUTES.DASHBOARD_BROWSE_REQUESTS),
                  }}
                />
              )}
            </CardContent>
          </Card>
        </div>

        {/* Earnings Overview */}
        <Card className="mt-8">
          <CardHeader>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Earnings Overview
              </h2>
              <Link href={ROUTES.DASHBOARD_EARNINGS}>
                <Button variant="outline" size="sm">
                  View Details
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <p className="text-sm font-medium text-green-800 dark:text-green-300">
                  Completed Jobs
                </p>
                <p className="text-2xl font-bold text-green-900 dark:text-green-200 mt-2">
                  {completedCount}
                </p>
              </div>
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <p className="text-sm font-medium text-blue-800 dark:text-blue-300">
                  Jobs in Progress
                </p>
                <p className="text-2xl font-bold text-blue-900 dark:text-blue-200 mt-2">
                  {activeJobsCount}
                </p>
              </div>
              <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                <p className="text-sm font-medium text-purple-800 dark:text-purple-300">
                  Pending Proposals
                </p>
                <p className="text-2xl font-bold text-purple-900 dark:text-purple-200 mt-2">
                  {pendingProposals}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
