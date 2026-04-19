"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Loading } from "@/components/ui/Loading";
import { ErrorState } from "@/components/ui/ErrorState";
import { ProtectedRoute } from "@/components/shared/ProtectedRoute";
import { paymentService } from "@/services/payment-service";
import { jobService } from "@/services/job-service";
import { ROUTES } from "@/config/constants";
import { formatRelativeTime } from "@/utils/helpers";
import {
  ArrowLeft,
  Printer,
  CheckCircle,
  Clock,
  XCircle,
  RefreshCw,
  CreditCard,
} from "lucide-react";

const STATUS_BADGE: Record<
  string,
  { variant: "success" | "warning" | "danger" | "secondary"; icon: React.ReactNode; label: string }
> = {
  completed: { variant: "success", icon: <CheckCircle className="h-3.5 w-3.5" />, label: "Paid" },
  pending:   { variant: "warning", icon: <Clock className="h-3.5 w-3.5" />,        label: "Pending" },
  failed:    { variant: "danger",  icon: <XCircle className="h-3.5 w-3.5" />,       label: "Failed" },
  refunded:  { variant: "secondary", icon: <RefreshCw className="h-3.5 w-3.5" />,  label: "Refunded" },
};

function PaymentReceiptContent() {
  const params = useParams();
  const router = useRouter();
  const paymentId = params.id as string;

  const {
    data: payment,
    isLoading: paymentLoading,
    error: paymentError,
    refetch,
  } = useQuery({
    queryKey: ["payment", paymentId],
    queryFn: () => paymentService.getPaymentById(paymentId),
    enabled: !!paymentId,
  });

  const { data: job } = useQuery({
    queryKey: ["job", payment?.job_id],
    queryFn: () => jobService.getJobById(payment!.job_id),
    enabled: !!payment?.job_id,
  });

  if (paymentLoading) {
    return (
      <Layout>
        <div className="container-custom py-8">
          <Loading />
        </div>
      </Layout>
    );
  }

  if (paymentError || !payment) {
    return (
      <Layout>
        <div className="container-custom py-8">
          <ErrorState
            title="Receipt not found"
            message="We couldn't find the payment you're looking for."
            retry={() => refetch()}
          />
        </div>
      </Layout>
    );
  }

  const statusInfo = STATUS_BADGE[payment.status] ?? STATUS_BADGE.pending;
  const platformFee = payment.platform_fee ?? 0;
  const providerAmount = payment.provider_amount ?? payment.amount - platformFee;
  // Approximate GST (18%) included in platform fee
  const gst = Math.round(platformFee * 0.18 * 100) / 100;
  const jobTitle =
    job?.request?.description
      ? job.request.description.slice(0, 60) + (job.request.description.length > 60 ? "…" : "")
      : job?.id
      ? `Job #${job.display_id ?? job.id.slice(0, 8)}`
      : "—";

  const receiptDate = payment.paid_at ?? payment.created_at;

  return (
    <Layout>
      <div className="container-custom py-8 max-w-2xl mx-auto print:py-4">
        {/* Back button — hidden on print */}
        <div className="mb-6 flex items-center justify-between print:hidden">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <Button
            variant="outline"
            onClick={() => window.print()}
            aria-label="Print this receipt"
          >
            <Printer className="h-4 w-4 mr-2" />
            Print Receipt
          </Button>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <CreditCard className="h-5 w-5 text-primary-600" />
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Payment Receipt
                  </h1>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  #{payment.display_id ?? payment.id.slice(0, 8).toUpperCase()}
                </p>
              </div>
              <Badge variant={statusInfo.variant} className="flex items-center gap-1.5 text-sm px-3 py-1.5">
                {statusInfo.icon}
                {statusInfo.label}
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Job info */}
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
                Service
              </p>
              <p className="font-semibold text-gray-900 dark:text-white">
                {jobTitle}
              </p>
              {job && (
                <button
                  className="mt-1 text-xs text-primary-600 dark:text-primary-400 hover:underline"
                  onClick={() => router.push(ROUTES.DASHBOARD_JOB_DETAIL(job.id))}
                >
                  View Job →
                </button>
              )}
            </div>

            {/* Amount breakdown */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wide">
                Amount Breakdown
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Service Amount</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {payment.currency} {providerAmount.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Platform Fee</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {payment.currency} {(platformFee - gst).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">GST (18%)</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {payment.currency} {gst.toFixed(2)}
                  </span>
                </div>
                <div className="border-t border-gray-200 dark:border-gray-700 pt-2 mt-2 flex justify-between">
                  <span className="font-semibold text-gray-900 dark:text-white">Total Paid</span>
                  <span className="font-bold text-lg text-gray-900 dark:text-white">
                    {payment.currency} {payment.amount.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            {/* Metadata */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
                  Date
                </p>
                <p className="text-gray-900 dark:text-white">
                  {new Date(receiptDate).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {formatRelativeTime(receiptDate)}
                </p>
              </div>
              {payment.payment_method && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
                    Method
                  </p>
                  <p className="text-gray-900 dark:text-white capitalize">
                    {payment.payment_method.replace(/_/g, " ")}
                  </p>
                </div>
              )}
              {payment.transaction_id && (
                <div className="col-span-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
                    Transaction ID
                  </p>
                  <p className="font-mono text-xs text-gray-700 dark:text-gray-300 break-all">
                    {payment.transaction_id}
                  </p>
                </div>
              )}
              {payment.gateway && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
                    Gateway
                  </p>
                  <p className="text-gray-900 dark:text-white capitalize">
                    {payment.gateway}
                  </p>
                </div>
              )}
            </div>

            {/* Failed reason */}
            {payment.status === "failed" && payment.failed_reason && (
              <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 text-sm text-red-700 dark:text-red-400">
                <strong>Failure reason:</strong> {payment.failed_reason}
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap gap-3 pt-2 print:hidden">
              <Button
                variant="outline"
                onClick={() => router.push(ROUTES.DASHBOARD_PAYMENT_HISTORY)}
              >
                Payment History
              </Button>
              {payment.status === "completed" && (
                <Button
                  variant="outline"
                  onClick={() => router.push(ROUTES.DASHBOARD_DISPUTES)}
                >
                  Raise a Dispute
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}

export default function PaymentReceiptPage() {
  return (
    <ProtectedRoute>
      <PaymentReceiptContent />
    </ProtectedRoute>
  );
}
