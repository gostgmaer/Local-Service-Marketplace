"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { isNotificationsEnabled } from "@/config/features";
import { ROUTES } from "@/config/constants";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Loading } from "@/components/ui/Loading";
import { SkeletonListItem } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { notificationService } from "@/services/notification-service";
import { useNotificationStore } from "@/store/notificationStore";
import { formatRelativeTime } from "@/utils/helpers";
import { Check, Bell, AlertCircle, CheckCircle, MessageCircle, FileText } from "lucide-react";
import { ProtectedRoute } from "@/components/shared/ProtectedRoute";

export default function NotificationsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { setUnreadCount } = useNotificationStore();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [unreadOnly, setUnreadOnly] = useState(false);

  const TYPE_FILTERS = [
    { value: "all", label: "All" },
    { value: "payment", label: "Payments" },
    { value: "message", label: "Messages" },
    { value: "system", label: "System" },
  ];

  function getNotificationIcon(type: string, read: boolean) {
    const base = read ? "bg-gray-200 dark:bg-gray-700" : "";
    switch (type) {
      case "payment_failed":
        return (
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${read ? base : "bg-red-100 dark:bg-red-900/30"}`}>
            <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
          </div>
        );
      case "payment_completed":
        return (
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${read ? base : "bg-green-100 dark:bg-green-900/30"}`}>
            <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
          </div>
        );
      case "message_received":
        return (
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${read ? base : "bg-blue-100 dark:bg-blue-900/30"}`}>
            <MessageCircle className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
        );
      case "document_expiry":
        return (
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${read ? base : "bg-yellow-100 dark:bg-yellow-900/30"}`}>
            <FileText className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
          </div>
        );
      default:
        return (
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${read ? base : "bg-primary-100 dark:bg-primary-900/30"}`}>
            <Bell className="h-5 w-5 text-primary-600 dark:text-primary-400" />
          </div>
        );
    }
  }

  // Redirect if not authenticated or notifications are disabled
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push(ROUTES.LOGIN);
    } else if (!authLoading && isAuthenticated && !isNotificationsEnabled()) {
      router.push(ROUTES.DASHBOARD);
    }
  }, [isAuthenticated, authLoading, router]);

  const {
    data: notifications,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => notificationService.getNotifications({ limit: 50 }),
    enabled: isNotificationsEnabled() && isAuthenticated,
  });

  const markAsReadMutation = useMutation({
    mutationFn: (id: string) => notificationService.markAsRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      const unread = notifications?.filter((n) => !n.read).length || 0;
      setUnreadCount(Math.max(0, unread - 1));
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: () => notificationService.markAllAsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      setUnreadCount(0);
    },
  });

  if (authLoading) {
    return <Loading />;
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <ProtectedRoute>
      <Layout>
        <div className="container-custom py-8">
          {error ? (
            <ErrorState
              title="Failed to load notifications"
              message="We couldn't load your notifications. Please try again."
              retry={() => refetch()}
            />
          ) : (
            <>
              {/* Accessible live region for dynamic unread count changes */}
              <div
                role="status"
                aria-live="polite"
                aria-atomic="true"
                className="sr-only"
              >
                {notifications
                  ? `${notifications.filter((n) => !n.read).length} unread notifications`
                  : ""}
              </div>
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                    Notifications
                  </h1>
                  <p className="mt-2 text-gray-600 dark:text-gray-400">
                    Stay updated with your latest activities
                  </p>
                </div>
                {notifications && notifications.some((n) => !n.read) && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => markAllAsReadMutation.mutate()}
                    isLoading={markAllAsReadMutation.isPending}
                  >
                    <Check className="h-4 w-4 mr-2" />
                    Mark All as Read
                  </Button>
                )}
              </div>

              {/* Filters */}
              <div className="flex flex-wrap items-center gap-3 mb-6">
                {/* Type filter tabs */}
                <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg">
                  {TYPE_FILTERS.map((t) => (
                    <button
                      key={t.value}
                      onClick={() => setTypeFilter(t.value)}
                      className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors min-h-[36px] ${
                        typeFilter === t.value
                          ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                          : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                      }`}
                      aria-pressed={typeFilter === t.value}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
                {/* Unread toggle */}
                <button
                  onClick={() => setUnreadOnly(!unreadOnly)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors min-h-[36px] ${
                    unreadOnly
                      ? "border-primary-500 text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20"
                      : "border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-400"
                  }`}
                  aria-pressed={unreadOnly}
                >
                  <Bell className="h-3.5 w-3.5" />
                  Unread only
                </button>
              </div>

              {isLoading ? (
                <Card>
                  <CardContent>
                    <div className="space-y-1 divide-y divide-gray-100 dark:divide-gray-800">
                      {[...Array(5)].map((_, i) => (
                        <div key={i} className="py-3">
                          <SkeletonListItem />
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ) : notifications && notifications.length > 0 ? (
                (() => {
                  const displayed = notifications.filter((n) => {
                    const typeMatch =
                      typeFilter === "all" ||
                      (typeFilter === "payment" && (n.type === "payment_completed" || n.type === "payment_failed")) ||
                      (typeFilter === "message" && n.type === "message_received") ||
                      (typeFilter === "system" && !["payment_completed", "payment_failed", "message_received"].includes(n.type));
                    const unreadMatch = !unreadOnly || !n.read;
                    return typeMatch && unreadMatch;
                  });
                  return displayed.length === 0 ? (
                    <EmptyState
                      title="No notifications here"
                      description={unreadOnly ? "You have no unread notifications in this category." : "No notifications match the selected filter."}
                      icon="inbox"
                    />
                  ) : (
                <Card>
                  <CardContent>
                    <div className="divide-y">
                      {displayed.map((notification) => (
                        <div
                          key={notification.id}
                          className={`py-4 ${notification.read ? "opacity-60" : "bg-blue-50 dark:bg-blue-900/20"}`}
                        >
                          <div className="flex items-start gap-4">
                            <div className="flex-shrink-0">
                              {getNotificationIcon(notification.type, notification.read)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-gray-900 dark:text-white">
                                {notification.message}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                                {formatRelativeTime(notification.created_at)}
                              </p>
                            </div>
                            {!notification.read && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  markAsReadMutation.mutate(notification.id)
                                }
                              >
                                Mark as Read
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
                  );
                })()
              ) : (
                <EmptyState
                  title="No notifications yet"
                  description="You'll be notified here about jobs, proposals, payments and messages."
                  icon="inbox"
                  action={{ label: "Go to Dashboard", onClick: () => router.push(ROUTES.DASHBOARD) }}
                />
              )}
            </>
          )}
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
