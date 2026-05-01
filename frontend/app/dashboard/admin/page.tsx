"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { useRealtimeList } from "@/hooks/useRealtimeList";
import { Permission } from "@/utils/permissions";
import { ROUTES } from "@/config/constants";
import { Layout } from "@/components/layout/Layout";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { adminService } from "@/services/admin-service";
import { formatRelativeTime } from "@/utils/helpers";
import Link from "next/link";
import { ErrorState } from "@/components/ui/ErrorState";
import {
  Users,
  AlertCircle,
  Settings,
  Briefcase,
  ClipboardList,
  CreditCard,
} from "lucide-react";
import { Loading } from "@/components/ui/Loading";
import { ProtectedRoute } from "@/components/shared/ProtectedRoute";

export default function AdminDashboardPage() {
  const { user: _user } = useAuth();
  const { can } = usePermissions();

  const {
    data: users,
    isLoading: usersLoading,
    error: usersError,
    refetch: refetchUsers,
  } = useQuery({
    queryKey: ["admin-users-recent"],
    queryFn: () => adminService.getUsers({ page: 1, limit: 5 }),
    enabled: can(Permission.ADMIN_ACCESS),
    staleTime: 30_000,
  });

  const {
    data: disputes,
    isLoading: disputesLoading,
    error: disputesError,
  } = useQuery({
    queryKey: ["admin-disputes-recent"],
    queryFn: () => adminService.getDisputes({ page: 1, limit: 5 }),
    enabled: can(Permission.ADMIN_ACCESS),
    staleTime: 30_000,
  });

  const { data: userStats } = useQuery({
    queryKey: ["admin-users-stats"],
    queryFn: () => adminService.getSystemStats(),
    enabled: can(Permission.ADMIN_ACCESS),
    staleTime: 60_000,
  });

  const { data: disputeStats } = useQuery({
    queryKey: ["admin-disputes-stats"],
    queryFn: () => adminService.getDisputeStats(),
    enabled: can(Permission.ADMIN_ACCESS),
    staleTime: 60_000,
  });

  const { data: jobStats } = useQuery({
    queryKey: ["admin-jobs-stats"],
    queryFn: () => adminService.getJobStats(),
    enabled: can(Permission.ADMIN_ACCESS),
    staleTime: 60_000,
  });

  const { data: requestStats } = useQuery({
    queryKey: ["admin-requests-stats"],
    queryFn: () => adminService.getRequestStats(),
    enabled: can(Permission.ADMIN_ACCESS),
    staleTime: 60_000,
  });

  const { data: paymentStats } = useQuery({
    queryKey: ["admin-payments-stats"],
    queryFn: () => adminService.getPaymentStats(),
    enabled: can(Permission.ADMIN_ACCESS),
    staleTime: 60_000,
  });

  const {
    data: infraHealth,
    isLoading: infraHealthLoading,
    error: infraHealthError,
    refetch: refetchInfraHealth,
  } = useQuery({
    queryKey: ["admin-infra-health"],
    queryFn: () => adminService.getInfrastructureHealth(),
    enabled: can(Permission.ADMIN_ACCESS),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  // Real-time invalidation for admin dashboard queries
  useRealtimeList(["user:created", "user:updated", "user:deleted"], ["admin-users-recent"]);
  useRealtimeList(["user:created", "user:updated", "user:deleted"], ["admin-users-stats"]);
  useRealtimeList(["dispute:created", "dispute:updated"], ["admin-disputes-recent"]);
  useRealtimeList(["dispute:created", "dispute:updated"], ["admin-disputes-stats"]);
  useRealtimeList(["job:created", "job:updated", "job:completed", "job:deleted"], ["admin-jobs-stats"]);
  useRealtimeList(["request:created", "request:updated", "request:deleted"], ["admin-requests-stats"]);
  useRealtimeList(["payment:created", "payment:completed", "payment:updated", "payment:failed", "payment:refunded"], ["admin-payments-stats"]);

  const totalUsers = userStats?.total ?? 0;
  const activeDisputes = disputeStats?.byStatus?.open ?? 0;
  const totalRevenue = paymentStats?.totalRevenue ?? 0;
  const totalRequests = requestStats?.total ?? 0;
  const totalJobs = jobStats?.total ?? 0;
  const completedJobs = jobStats?.byStatus?.completed ?? 0;
  const requestCompletionRate =
    totalRequests > 0
      ? Math.round(
          ((requestStats?.byStatus?.completed ?? 0) / totalRequests) * 100,
        )
      : 0;
  const jobSuccessRate =
    totalJobs > 0 ? Math.round((completedJobs / totalJobs) * 100) : 0;
  const disputeRate =
    totalJobs > 0
      ? Math.round(((jobStats?.byStatus?.disputed ?? 0) / totalJobs) * 100)
      : 0;

  const formatDependencyLabel = (name: string): string =>
    name
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/\b\w/g, (char) => char.toUpperCase());

  const allInfraServiceMeta = [
    { key: "identity", label: "Identity", serviceName: "identity-service" },
    {
      key: "marketplace",
      label: "Marketplace",
      serviceName: "marketplace-service",
    },
    { key: "payment", label: "Payment", serviceName: "payment-service" },
    { key: "comms", label: "Comms", serviceName: "comms-service" },
    { key: "oversight", label: "Oversight", serviceName: "oversight-service" },
    {
      key: "infrastructure",
      label: "Infrastructure",
      serviceName: "infrastructure-service",
    },
  ] as const;

  const infraServices = infraHealth?.services ?? {};
  const infraServiceMeta = allInfraServiceMeta.filter(
    (meta) =>
      meta.key !== "infrastructure" ||
      Object.prototype.hasOwnProperty.call(infraServices, "infrastructure"),
  );
  const infraServiceRows = infraServiceMeta.map((meta) => {
    const service = (infraServices as Record<string, any>)[meta.key];
    const status = service?.status === "ok" ? "ok" : "down";

    const databaseSource = service?.checks?.database || service?.database;
    const databaseCheck = databaseSource
      ? {
          status: databaseSource.status === "ok" ? "ok" : "down",
          responseTime: databaseSource.responseTime || "-",
          message:
            databaseSource.message ||
            (databaseSource.status === "ok"
              ? "Database is reachable"
              : "Database check failed"),
        }
      : undefined;

    const redisSource = service?.checks?.redis || service?.redis;
    const redisCheck = redisSource
      ? {
          status: redisSource.status === "ok" ? "ok" : "down",
          responseTime: redisSource.responseTime || "-",
          message:
            redisSource.message ||
            (redisSource.status === "ok"
              ? "Redis is reachable"
              : "Redis check failed"),
          enabled: redisSource.enabled,
        }
      : undefined;

    const dependencySource =
      service?.checks?.dependencies || service?.dependencies || {};
    const dependencyChecks = Object.entries(dependencySource).map(
      ([depKey, depValue]: [string, any]) => {
        const depStatus = depValue?.status === "ok" ? "ok" : "down";
        return {
          key: depKey,
          label: formatDependencyLabel(depKey),
          status: depStatus,
          responseTime: depValue?.responseTime || "-",
          message:
            depValue?.message ||
            (depStatus === "ok"
              ? "Dependency is healthy"
              : "Dependency check failed"),
        };
      },
    );

    const downDependencyCount = dependencyChecks.filter(
      (dependency) => dependency.status === "down",
    ).length;

    return {
      ...meta,
      status,
      responseTime: service?.responseTime || "—",
      message:
        service?.message ||
        service?.checks?.database?.message ||
        service?.checks?.redis?.message ||
        (status === "ok" ? "All checks passed" : "Service is unavailable"),
      databaseCheck,
      redisCheck,
      dependencyChecks,
      dependencySummary: {
        total: dependencyChecks.length,
        ok: dependencyChecks.length - downDependencyCount,
        down: downDependencyCount,
      },
    };
  });

  const resolvedInfraSummary = infraHealth?.summary ?? {
    total: infraServiceRows.length,
    ok: infraServiceRows.filter((svc) => svc.status === "ok").length,
    down: infraServiceRows.filter((svc) => svc.status !== "ok").length,
    downServices: infraServiceRows
      .filter((svc) => svc.status !== "ok")
      .map((svc) => svc.key),
  };

  const isStatsLoading = !userStats || !disputeStats || !jobStats || !requestStats || !paymentStats;

  return (
    <ProtectedRoute requiredPermissions={[Permission.ADMIN_ACCESS]}>
      <Layout>
        <div className="container-custom py-12">
          {usersError || disputesError ? (
            <ErrorState
              title="Failed to load admin data"
              message="We couldn't load admin dashboard data. Please try again."
              retry={() => refetchUsers()}
            />
          ) : (
            <>
              {/* Header */}
              <div className="mb-10">
                <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-white mb-3">
                  Admin Dashboard
                </h1>
                <p className="text-lg text-gray-600 dark:text-gray-400">
                  Platform-wide overview and management
                </p>
              </div>

              {/* Infrastructure Health */}
              <Card className="mb-10">
                <CardHeader>
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Infrastructure Health
                      </h2>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Live status of all core services, database checks, and dependencies
                      </p>
                    </div>
                    {infraHealth?.timestamp && (
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Updated {formatRelativeTime(infraHealth.timestamp)}
                      </p>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {infraHealthLoading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                      {[...Array(6)].map((_, idx) => (
                        <div
                          key={idx}
                          className="rounded-xl border border-gray-200 dark:border-gray-700 p-4"
                        >
                          <Skeleton className="h-4 w-24 mb-2" />
                          <Skeleton className="h-3 w-32 mb-3" />
                          <Skeleton className="h-3 w-20 mb-2" />
                          <Skeleton className="h-3 w-full" />
                        </div>
                      ))}
                    </div>
                  ) : infraHealthError ? (
                    <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                      <p className="text-sm text-red-700 dark:text-red-300">
                        Unable to load infrastructure health. Please retry.
                      </p>
                      <Button variant="outline" size="sm" onClick={() => refetchInfraHealth()}>
                        Retry Health Check
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="flex flex-wrap items-center gap-3 mb-4">
                        <StatusBadge status={infraHealth?.status || "down"} />
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          {resolvedInfraSummary.ok}/{resolvedInfraSummary.total} services healthy
                        </span>
                        {resolvedInfraSummary.down > 0 && (
                          <span className="text-sm font-medium text-red-600 dark:text-red-400">
                            {resolvedInfraSummary.down} service(s) down
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {infraServiceRows.map((service) => (
                          <div
                            key={service.key}
                            className="rounded-xl border border-gray-200 dark:border-gray-700 p-4"
                          >
                            <div className="flex items-start justify-between gap-3 mb-3">
                              <div>
                                <p className="font-semibold text-gray-900 dark:text-white text-sm">
                                  {service.label}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                  {service.serviceName}
                                </p>
                              </div>
                              <StatusBadge status={service.status} />
                            </div>

                            <div className="space-y-1.5">
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                Response time:{" "}
                                <span className="font-semibold text-gray-900 dark:text-white">
                                  {service.responseTime}
                                </span>
                              </p>
                              <p
                                className={`text-xs ${
                                  service.status === "ok"
                                    ? "text-green-600 dark:text-green-400"
                                    : "text-red-600 dark:text-red-400"
                                }`}
                              >
                                {service.message}
                              </p>
                            </div>

                            <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 space-y-2">
                              <div className="flex items-center justify-between">
                                <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                                  Database
                                </p>
                                {service.databaseCheck ? (
                                  <StatusBadge
                                    status={service.databaseCheck.status}
                                    size="sm"
                                  />
                                ) : (
                                  <span className="text-xs text-gray-500 dark:text-gray-400">
                                    Not configured
                                  </span>
                                )}
                              </div>
                              {service.databaseCheck && (
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                  {service.databaseCheck.responseTime} - {service.databaseCheck.message}
                                </p>
                              )}
                            </div>

                            <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 space-y-2">
                              <div className="flex items-center justify-between">
                                <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                                  Redis
                                </p>
                                {service.redisCheck ? (
                                  <StatusBadge
                                    status={service.redisCheck.status}
                                    size="sm"
                                  />
                                ) : (
                                  <span className="text-xs text-gray-500 dark:text-gray-400">
                                    Not configured
                                  </span>
                                )}
                              </div>
                              {service.redisCheck && (
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                  {service.redisCheck.responseTime} - {service.redisCheck.message}
                                </p>
                              )}
                            </div>

                            <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                              <div className="flex items-center justify-between">
                                <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                                  Dependencies
                                </p>
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                  {service.dependencySummary.ok}/{service.dependencySummary.total} healthy
                                </span>
                              </div>

                              {service.dependencyChecks.length > 0 ? (
                                <div className="mt-2 space-y-2">
                                  {service.dependencyChecks.map((dependency) => (
                                    <div
                                      key={`${service.key}-${dependency.key}`}
                                      className="rounded-lg border border-gray-100 dark:border-gray-700/70 p-2.5"
                                    >
                                      <div className="flex items-center justify-between gap-2">
                                        <p className="text-xs font-medium text-gray-900 dark:text-white">
                                          {dependency.label}
                                        </p>
                                        <div className="flex items-center gap-2">
                                          <span className="text-[11px] text-gray-500 dark:text-gray-400">
                                            {dependency.responseTime}
                                          </span>
                                          <StatusBadge
                                            status={dependency.status}
                                            size="sm"
                                          />
                                        </div>
                                      </div>
                                      <p
                                        className={`text-[11px] mt-1 ${
                                          dependency.status === "ok"
                                            ? "text-green-600 dark:text-green-400"
                                            : "text-red-600 dark:text-red-400"
                                        }`}
                                      >
                                        {dependency.message}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                                  No external dependency configured
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                    </>
                  )}
                </CardContent>
              </Card>

              {/* Top KPI Bar */}
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-10">
                {isStatsLoading
                  ? [...Array(5)].map((_, i) => (
                      <Card key={i}>
                        <CardContent className="p-5">
                          <Skeleton className="h-9 w-9 rounded-lg mb-3" />
                          <Skeleton className="h-7 w-16 mb-2" />
                          <Skeleton className="h-3 w-24" />
                        </CardContent>
                      </Card>
                    ))
                  : [
                  {
                    label: "Total Users",
                    value: totalUsers,
                    icon: <Users className="h-5 w-5" />,
                    color: "text-blue-600",
                    bg: "bg-blue-50 dark:bg-blue-900/20",
                  },
                  {
                    label: "Total Requests",
                    value: requestStats?.total ?? "—",
                    icon: <ClipboardList className="h-5 w-5" />,
                    color: "text-purple-600",
                    bg: "bg-purple-50 dark:bg-purple-900/20",
                  },
                  {
                    label: "Total Jobs",
                    value: jobStats?.total ?? "—",
                    icon: <Briefcase className="h-5 w-5" />,
                    color: "text-orange-600",
                    bg: "bg-orange-50 dark:bg-orange-900/20",
                  },
                  {
                    label: "Active Disputes",
                    value: activeDisputes,
                    icon: <AlertCircle className="h-5 w-5" />,
                    color: "text-red-600",
                    bg: "bg-red-50 dark:bg-red-900/20",
                  },
                  {
                    label: "Total Revenue",
                    value: `₹${totalRevenue.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                    icon: <CreditCard className="h-5 w-5" />,
                    color: "text-green-600",
                    bg: "bg-green-50 dark:bg-green-900/20",
                  },
                ].map(({ label, value, icon, color, bg }) => (
                  <Card key={label} hover>
                    <CardContent className="p-5">
                      <div
                        className={`inline-flex items-center justify-center w-9 h-9 rounded-lg mb-3 ${bg} ${color}`}
                      >
                        {icon}
                      </div>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        {value}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {label}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Performance Insights */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
                {isStatsLoading
                  ? [...Array(3)].map((_, i) => (
                      <Card key={i}>
                        <CardContent className="p-5">
                          <Skeleton className="h-3 w-32 mb-3" />
                          <Skeleton className="h-8 w-16 mb-3" />
                          <Skeleton className="h-2 w-full rounded-full" />
                        </CardContent>
                      </Card>
                    ))
                  : [
                  {
                    label: "Requests Completion",
                    rate: requestCompletionRate,
                    barColor: "bg-green-500",
                    badge: <span className="text-sm text-green-600">Healthy</span>,
                  },
                  {
                    label: "Jobs Success",
                    rate: jobSuccessRate,
                    barColor: "bg-blue-500",
                    badge: <span className="text-sm text-blue-600">Stable</span>,
                  },
                  {
                    label: "Dispute Pressure",
                    rate: disputeRate,
                    barColor: "bg-red-500",
                    badge: <span className="text-sm text-red-600">{activeDisputes} open</span>,
                  },
                ].map(({ label, rate, barColor, badge }) => (
                  <Card key={label}>
                    <CardContent className="p-5">
                      <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        {label}
                      </p>
                      <div className="mt-2 flex items-end justify-between">
                        <p className="text-3xl font-bold text-gray-900 dark:text-white">
                          {rate}%
                        </p>
                        {badge}
                      </div>
                      <div className="mt-3 h-2 rounded-full bg-gray-100 dark:bg-gray-700">
                        <div
                          className={`h-2 rounded-full ${barColor}`}
                          style={{ width: `${Math.min(rate, 100)}%` }}
                        />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Service Breakdown */}
              <div className="mb-10">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-5">
                  Service Breakdown
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                  {/* Users */}
                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between mb-5">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900/30">
                            <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900 dark:text-white text-sm">
                              Users
                            </p>
                            <p className="text-xs text-gray-400">
                              identity-service
                            </p>
                          </div>
                        </div>
                        <span className="text-2xl font-bold text-gray-900 dark:text-white">
                          {userStats?.total ?? "—"}
                        </span>
                      </div>
                      <div className="space-y-3">
                        <div>
                          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                            <span>Active</span>
                            <span className="font-semibold text-gray-900 dark:text-white">
                              {userStats?.byStatus?.active ?? 0}
                            </span>
                          </div>
                          <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-1.5">
                            <div
                              className="bg-green-500 h-1.5 rounded-full"
                              style={{
                                width: `${userStats && userStats.total > 0 ? Math.round((userStats.byStatus.active / userStats.total) * 100) : 0}%`,
                              }}
                            />
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                            <span>Suspended</span>
                            <span className="font-semibold text-gray-900 dark:text-white">
                              {userStats?.byStatus?.suspended ?? 0}
                            </span>
                          </div>
                          <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-1.5">
                            <div
                              className="bg-red-400 h-1.5 rounded-full"
                              style={{
                                width: `${userStats && userStats.total > 0 ? Math.round((userStats.byStatus.suspended / userStats.total) * 100) : 0}%`,
                              }}
                            />
                          </div>
                        </div>
                      </div>
                      <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 grid grid-cols-3 gap-1 text-center text-xs text-gray-500 dark:text-gray-400">
                        <div>
                          <p className="font-bold text-sm text-gray-900 dark:text-white">
                            {userStats?.byRole?.customer ?? "—"}
                          </p>
                          <p>Customers</p>
                        </div>
                        <div>
                          <p className="font-bold text-sm text-gray-900 dark:text-white">
                            {userStats?.byRole?.provider ?? "—"}
                          </p>
                          <p>Providers</p>
                        </div>
                        <div>
                          <p className="font-bold text-sm text-gray-900 dark:text-white">
                            {userStats?.byRole?.admin ?? "—"}
                          </p>
                          <p>Admins</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Requests */}
                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between mb-5">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-100 dark:bg-purple-900/30">
                            <ClipboardList className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900 dark:text-white text-sm">
                              Requests
                            </p>
                            <p className="text-xs text-gray-400">
                              marketplace-service
                            </p>
                          </div>
                        </div>
                        <span className="text-2xl font-bold text-gray-900 dark:text-white">
                          {requestStats?.total ?? "—"}
                        </span>
                      </div>
                      <div className="space-y-2.5">
                        {(
                          [
                            {
                              label: "Open",
                              value: requestStats?.byStatus?.open,
                              dot: "bg-blue-500",
                            },
                            {
                              label: "Assigned",
                              value: requestStats?.byStatus?.assigned,
                              dot: "bg-yellow-500",
                            },
                            {
                              label: "Completed",
                              value: requestStats?.byStatus?.completed,
                              dot: "bg-green-500",
                            },
                            {
                              label: "Cancelled",
                              value: requestStats?.byStatus?.cancelled,
                              dot: "bg-gray-400",
                            },
                          ] as const
                        ).map(({ label, value, dot }) => (
                          <div
                            key={label}
                            className="flex items-center justify-between text-sm"
                          >
                            <span className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                              <span className={`w-2 h-2 rounded-full ${dot}`} />
                              {label}
                            </span>
                            <span className="font-semibold text-gray-900 dark:text-white">
                              {value ?? "—"}
                            </span>
                          </div>
                        ))}
                      </div>
                      {requestStats && requestStats.total > 0 && (
                        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
                          <p>
                            Completion rate:{" "}
                            <span className="font-semibold text-green-600">
                              {Math.round(
                                ((requestStats.byStatus.completed ?? 0) /
                                  requestStats.total) *
                                  100,
                              )}
                              %
                            </span>
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Jobs */}
                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between mb-5">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-100 dark:bg-orange-900/30">
                            <Briefcase className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900 dark:text-white text-sm">
                              Jobs
                            </p>
                            <p className="text-xs text-gray-400">
                              marketplace-service
                            </p>
                          </div>
                        </div>
                        <span className="text-2xl font-bold text-gray-900 dark:text-white">
                          {jobStats?.total ?? "—"}
                        </span>
                      </div>
                      <div className="space-y-2.5">
                        {(
                          [
                            {
                              label: "Scheduled",
                              value: jobStats?.byStatus?.scheduled,
                              dot: "bg-blue-500",
                            },
                            {
                              label: "In Progress",
                              value: jobStats?.byStatus?.in_progress,
                              dot: "bg-yellow-500",
                            },
                            {
                              label: "Completed",
                              value: jobStats?.byStatus?.completed,
                              dot: "bg-green-500",
                            },
                            {
                              label: "Cancelled",
                              value: jobStats?.byStatus?.cancelled,
                              dot: "bg-gray-400",
                            },
                            {
                              label: "Disputed",
                              value: jobStats?.byStatus?.disputed,
                              dot: "bg-red-500",
                            },
                          ] as const
                        ).map(({ label, value, dot }) => (
                          <div
                            key={label}
                            className="flex items-center justify-between text-sm"
                          >
                            <span className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                              <span className={`w-2 h-2 rounded-full ${dot}`} />
                              {label}
                            </span>
                            <span className="font-semibold text-gray-900 dark:text-white">
                              {value ?? "—"}
                            </span>
                          </div>
                        ))}
                      </div>
                      {jobStats && jobStats.total > 0 && (
                        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
                          <p>
                            Success rate:{" "}
                            <span className="font-semibold text-green-600">
                              {Math.round(
                                ((jobStats.byStatus.completed ?? 0) /
                                  jobStats.total) *
                                  100,
                              )}
                              %
                            </span>
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Payments */}
                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between mb-5">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-green-100 dark:bg-green-900/30">
                            <CreditCard className="h-4 w-4 text-green-600 dark:text-green-400" />
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900 dark:text-white text-sm">
                              Payments
                            </p>
                            <p className="text-xs text-gray-400">
                              payment-service
                            </p>
                          </div>
                        </div>
                        <span className="text-2xl font-bold text-gray-900 dark:text-white">
                          {paymentStats?.total ?? "—"}
                        </span>
                      </div>
                      <div className="mb-4 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800">
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">
                          Total Revenue
                        </p>
                        <p className="text-xl font-bold text-green-600">
                          $
                          {paymentStats
                            ? paymentStats.totalRevenue.toLocaleString(
                                undefined,
                                {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                },
                              )
                            : "—"}
                        </p>
                      </div>
                      <div className="space-y-2.5">
                        {(
                          [
                            {
                              label: "Completed",
                              value: paymentStats?.byStatus?.completed,
                              dot: "bg-green-500",
                            },
                            {
                              label: "Pending",
                              value: paymentStats?.byStatus?.pending,
                              dot: "bg-yellow-500",
                            },
                            {
                              label: "Failed",
                              value: paymentStats?.byStatus?.failed,
                              dot: "bg-red-500",
                            },
                            {
                              label: "Refunded",
                              value: paymentStats?.byStatus?.refunded,
                              dot: "bg-gray-400",
                            },
                          ] as const
                        ).map(({ label, value, dot }) => (
                          <div
                            key={label}
                            className="flex items-center justify-between text-sm"
                          >
                            <span className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                              <span className={`w-2 h-2 rounded-full ${dot}`} />
                              {label}
                            </span>
                            <span className="font-semibold text-gray-900 dark:text-white">
                              {value ?? "—"}
                            </span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* Dispute Monitoring */}
              <div className="mb-10">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-5">
                  Dispute Monitoring
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {(
                    [
                      {
                        label: "Open",
                        value: disputeStats?.byStatus?.open,
                        color: "text-red-600",
                        bg: "bg-red-50 dark:bg-red-900/20",
                        border: "border-red-200 dark:border-red-800",
                        sub: "Needs attention",
                      },
                      {
                        label: "Investigating",
                        value: disputeStats?.byStatus?.investigating,
                        color: "text-yellow-600",
                        bg: "bg-yellow-50 dark:bg-yellow-900/20",
                        border: "border-yellow-200 dark:border-yellow-800",
                        sub: "Under review",
                      },
                      {
                        label: "Resolved",
                        value: disputeStats?.byStatus?.resolved,
                        color: "text-green-600",
                        bg: "bg-green-50 dark:bg-green-900/20",
                        border: "border-green-200 dark:border-green-800",
                        sub: "Decision made",
                      },
                      {
                        label: "Closed",
                        value: disputeStats?.byStatus?.closed,
                        color: "text-gray-600 dark:text-gray-300",
                        bg: "bg-gray-50 dark:bg-gray-800",
                        border: "border-gray-200 dark:border-gray-700",
                        sub: "Finalised",
                      },
                    ] as const
                  ).map(({ label, value, color, bg, border, sub }) => (
                    <div
                      key={label}
                      className={`rounded-xl border p-5 ${bg} ${border}`}
                    >
                      <p className={`text-4xl font-bold ${color} mb-1`}>
                        {value ?? "—"}
                      </p>
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {label}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {sub}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick Actions */}
              <Card className="mb-10">
                <CardHeader>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Quick Actions
                  </h2>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Link href={ROUTES.DASHBOARD_ADMIN_USERS}>
                      <Button
                        variant="outline"
                        className="w-full justify-start"
                      >
                        <Users className="h-4 w-4 mr-2" />
                        Manage Users
                      </Button>
                    </Link>
                    <Link href={ROUTES.DASHBOARD_ADMIN_DISPUTES}>
                      <Button
                        variant="outline"
                        className="w-full justify-start"
                      >
                        <AlertCircle className="h-4 w-4 mr-2" />
                        Review Disputes
                      </Button>
                    </Link>
                    <Link href={ROUTES.DASHBOARD_ADMIN_SETTINGS}>
                      <Button
                        variant="outline"
                        className="w-full justify-start"
                      >
                        <Settings className="h-4 w-4 mr-2" />
                        System Settings
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>

              {/* Recent Activity */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Recent Users */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Recent Users
                      </h2>
                      <Link href={ROUTES.DASHBOARD_ADMIN_USERS}>
                        <Button variant="outline" size="sm">
                          View All
                        </Button>
                      </Link>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {usersLoading ? (
                      <Loading size="sm" />
                    ) : users?.data && users.data.length > 0 ? (
                      <div className="space-y-3">
                        {users.data.slice(0, 5).map((u: any) => (
                          <div
                            key={u.id}
                            className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-md"
                          >
                            <div>
                              <p className="font-medium text-gray-900 dark:text-white">
                                {u.name || u.email}
                              </p>
                              <p className="text-sm text-gray-600 dark:text-gray-400">
                                {u.email}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                Role: {u.role} &bull; Joined{" "}
                                {formatRelativeTime(u.created_at)}
                              </p>
                            </div>
                            <StatusBadge status={u.status || "active"} />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-center py-8 text-gray-500 dark:text-gray-400">
                        No users found
                      </p>
                    )}
                  </CardContent>
                </Card>

                {/* Recent Disputes */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Recent Disputes
                      </h2>
                      <Link href={ROUTES.DASHBOARD_ADMIN_DISPUTES}>
                        <Button variant="outline" size="sm">
                          View All
                        </Button>
                      </Link>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {disputesLoading ? (
                      <Loading size="sm" />
                    ) : disputes?.data && disputes.data.length > 0 ? (
                      <div className="space-y-3">
                        {disputes.data.slice(0, 5).map((dispute: any) => (
                          <div
                            key={dispute.id}
                            className="p-3 border border-gray-200 dark:border-gray-700 rounded-md"
                          >
                            <div className="flex items-start justify-between mb-2">
                              <p className="text-sm font-medium text-gray-900 dark:text-white">
                                Job #
                                {dispute.job_display_id ||
                                  dispute.job_id?.slice(0, 8)}
                              </p>
                              <StatusBadge status={dispute.status} />
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                              {dispute.description ||
                                dispute.reason ||
                                "No description"}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                              Filed {formatRelativeTime(dispute.created_at)}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-center py-8 text-gray-500 dark:text-gray-400">
                        No disputes found
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
