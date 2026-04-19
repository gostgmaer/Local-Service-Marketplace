"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Layout } from "@/components/layout/Layout";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Loading } from "@/components/ui/Loading";
import { StatusBadge } from "@/components/ui/Badge";
import { ErrorState } from "@/components/ui/ErrorState";
import { ProtectedRoute } from "@/components/shared/ProtectedRoute";
import { disputeService } from "@/services/dispute-service";
import { ROUTES } from "@/config/constants";
import { formatDate, formatRelativeTime, formatDateTime } from "@/utils/helpers";
import {
  ArrowLeft,
  AlertTriangle,
  Briefcase,
  Calendar,
  User,
  CheckCircle,
  Clock,
} from "lucide-react";
import Link from "next/link";

const STATUS_STEPS = ["open", "investigating", "escalated", "resolved", "closed"] as const;

const REASON_LABELS: Record<string, string> = {
  not_completed: "Work Not Completed",
  poor_quality: "Poor Quality Work",
  no_show: "Provider No-Show",
  overcharged: "Overcharged",
  damaged_property: "Property Damaged",
  safety_concern: "Safety Concern",
  fraud: "Fraud / Scam",
  other: "Other",
};

export default function DisputeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const disputeId = params.id as string;

  const {
    data: dispute,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["dispute", disputeId],
    queryFn: () => disputeService.getDisputeById(disputeId),
    enabled: isAuthenticated && !!disputeId,
  });

  if (authLoading || isLoading) {
    return (
      <Layout>
        <div className="container-custom py-8">
          <Loading />
        </div>
      </Layout>
    );
  }

  if (error || !dispute) {
    return (
      <Layout>
        <div className="container-custom py-8">
          <ErrorState
            title="Dispute not found"
            message="We couldn't find this dispute or you don't have permission to view it."
            retry={() => router.push(ROUTES.DASHBOARD_DISPUTES)}
          />
        </div>
      </Layout>
    );
  }

  const currentStep = STATUS_STEPS.indexOf(dispute.status as any);

  return (
    <ProtectedRoute>
      <Layout>
        <div className="container-custom py-8 max-w-3xl mx-auto">
          <Link
            href={ROUTES.DASHBOARD_DISPUTES}
            className="inline-flex items-center text-primary-600 hover:text-primary-700 mb-6 text-sm"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to My Disputes
          </Link>

          {/* Header */}
          <div className="flex items-start justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                Dispute #
                {dispute.display_id || dispute.id.slice(0, 8).toUpperCase()}
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Filed {formatRelativeTime(dispute.created_at)}
              </p>
            </div>
            <StatusBadge status={dispute.status} />
          </div>

          {/* Progress Tracker */}
          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                {STATUS_STEPS.map((s, i) => (
                  <div key={s} className="flex-1 flex flex-col items-center">
                    <div className="relative flex items-center w-full">
                      {i > 0 && (
                        <div
                          className={`flex-1 h-0.5 ${i <= currentStep ? "bg-primary-500" : "bg-gray-200 dark:bg-gray-700"}`}
                        />
                      )}
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 border-2 ${
                          i < currentStep
                            ? "bg-primary-500 border-primary-500 text-white"
                            : i === currentStep
                              ? s === "escalated"
                                ? "bg-white dark:bg-gray-900 border-red-500 text-red-500"
                                : "bg-white dark:bg-gray-900 border-primary-500 text-primary-500"
                              : "bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-400"
                        }`}
                      >
                        {i < currentStep ? (
                          <CheckCircle className="h-5 w-5" />
                        ) : (
                          <Clock className="h-4 w-4" />
                        )}
                      </div>
                      {i < STATUS_STEPS.length - 1 && (
                        <div
                          className={`flex-1 h-0.5 ${i < currentStep ? "bg-primary-500" : "bg-gray-200 dark:bg-gray-700"}`}
                        />
                      )}
                    </div>
                    <p
                      className={`text-xs mt-2 capitalize font-medium ${
                        i === currentStep && s === "escalated"
                          ? "text-red-600 dark:text-red-400"
                          : i <= currentStep
                            ? "text-primary-600 dark:text-primary-400"
                            : "text-gray-400"
                      }`}
                    >
                      {s}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6">
            {/* Dispute Details */}
            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-orange-500" /> Dispute
                  Details
                </h2>
              </CardHeader>
              <CardContent>
                <dl className="space-y-4">
                  <div className="flex items-start gap-3">
                    <dt className="w-32 text-sm font-medium text-gray-500 dark:text-gray-400 shrink-0">
                      Reason
                    </dt>
                    <dd className="text-sm text-gray-900 dark:text-white font-medium">
                      {REASON_LABELS[dispute.reason] || dispute.reason}
                    </dd>
                  </div>
                  {dispute.description && (
                    <div className="flex items-start gap-3">
                      <dt className="w-32 text-sm font-medium text-gray-500 dark:text-gray-400 shrink-0">
                        Description
                      </dt>
                      <dd className="text-sm text-gray-900 dark:text-white leading-relaxed">
                        {dispute.description}
                      </dd>
                    </div>
                  )}
                  <div className="flex items-start gap-3">
                    <dt className="w-32 text-sm font-medium text-gray-500 dark:text-gray-400 shrink-0">
                      Status
                    </dt>
                    <dd>
                      <StatusBadge status={dispute.status} />
                    </dd>
                  </div>
                  {dispute.created_at && (
                    <div className="flex items-center gap-3">
                      <dt className="w-32 text-sm font-medium text-gray-500 dark:text-gray-400 shrink-0">
                        Filed On
                      </dt>
                      <dd className="text-sm text-gray-900 dark:text-white flex items-center gap-1">
                        <Calendar className="h-4 w-4 text-gray-400" />
                        {formatRelativeTime(dispute.created_at)}
                      </dd>
                    </div>
                  )}
                  {dispute.updated_at && (
                    <div className="flex items-center gap-3">
                      <dt className="w-32 text-sm font-medium text-gray-500 dark:text-gray-400 shrink-0">
                        Last Updated
                      </dt>
                      <dd className="text-sm text-gray-900 dark:text-white">
                        {formatRelativeTime(dispute.updated_at)}
                      </dd>
                    </div>
                  )}
                </dl>
              </CardContent>
            </Card>

            {/* Related Job */}
            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <Briefcase className="h-5 w-5 text-primary-500" /> Related Job
                </h2>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                      Job ID
                    </p>
                    <p className="text-gray-900 dark:text-white font-medium">
                      #
                      {dispute.job?.display_id ||
                        dispute.job_id.slice(0, 8).toUpperCase()}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      router.push(ROUTES.DASHBOARD_JOB_DETAIL(dispute.job_id))
                    }
                  >
                    View Job
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Resolution */}
            {(dispute.status === "resolved" || dispute.status === "closed") &&
              dispute.resolution && (
                <Card>
                  <CardHeader>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-green-500" />{" "}
                      Resolution
                    </h2>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">
                        {dispute.resolution}
                      </p>
                      {dispute.resolved_at && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                          <User className="h-3 w-3" />
                          Resolved on {formatDateTime(dispute.resolved_at)}
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

            {/* Open dispute info callout */}
            {dispute.status === "open" && (
              <Card className="border-orange-200 dark:border-orange-900/50 bg-orange-50/50 dark:bg-orange-900/10">
                <CardContent className="pt-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-orange-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-orange-800 dark:text-orange-200">
                        Dispute Under Review
                      </p>
                      <p className="text-sm text-orange-700 dark:text-orange-300 mt-1">
                        Our team will review this dispute within 2–3 business
                        days. Payment has been paused until this is resolved.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
