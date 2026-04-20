"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { useAuth } from "@/hooks/useAuth";
import { useRealtimeDetail } from "@/hooks/useRealtimeDetail";
import { usePublicSettings } from "@/hooks/usePublicSettings";
import { ROUTES } from "@/config/constants";
import { formatCurrency, formatRelativeTime } from "@/utils/helpers";
import {
  ArrowLeft,
  Printer,
  CheckCircle,
  Clock,
  XCircle,
  RefreshCw,
  CreditCard,
  FileText,
  ExternalLink,
  Building2,
  User2,
  Calendar,
  Banknote,
  Tag,
  Copy,
  Check,
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
  const { user } = useAuth();
  const { config: siteConfig } = usePublicSettings();
  const paymentId = params.id as string;
  const [copied, setCopied] = useState(false);
  const queryClient = useQueryClient();

  const retryMutation = useMutation({
    mutationFn: () => paymentService.retryPayment(paymentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payment", paymentId] });
    },
  });

  useRealtimeDetail(["payment:completed", "payment:updated", "payment:failed", "payment:refunded"], ["payment", paymentId], paymentId);
  // Also refresh the linked job card when job status changes (e.g. completed, disputed)
  useRealtimeDetail(["job:updated", "job:completed", "job:deleted"], ["job", payment?.job_id], payment?.job_id);

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
  const providerAmount = payment.provider_amount ?? 0;
  const gstRate = payment.gst_rate ?? siteConfig.gstRate;
  const gst = payment.gst_amount ?? Math.round(platformFee * (gstRate / 100) * 100) / 100;

  const serviceDescription =
    job?.request_description ??
    job?.request?.description ??
    null;
  const jobTitle = serviceDescription
    ? serviceDescription.slice(0, 80) + (serviceDescription.length > 80 ? "…" : "")
    : job?.id
    ? `Job #${job.display_id ?? job.id.slice(0, 8)}`
    : "—";

  const categoryName = job?.request_category_name ?? null;
  const providerName = job?.provider_name ?? job?.provider?.name ?? null;
  const providerBusiness = job?.provider_business_name ?? job?.provider?.business_name ?? null;
  const customerName = job?.customer_name ?? null;
  const customerEmail = job?.customer_email ?? null;

  const receiptDate = payment.paid_at ?? payment.created_at;

  function formatDateTime(iso: string) {
    const d = new Date(iso);
    return {
      date: d.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }),
      time: d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }),
    };
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const paid = formatDateTime(receiptDate);
  const created = formatDateTime(payment.created_at);

  return (
    <Layout>
      <div className="container-custom py-8  mx-auto print:py-4">
        {/* Top bar — hidden on print */}
        <div className="mb-6 flex items-center justify-between print:hidden">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          {/* Print button — only shown when invoice is ready */}
          {payment.invoice_url && (
            <Button
              variant="outline"
              onClick={() => window.print()}
              aria-label="Print this receipt"
            >
              <Printer className="h-4 w-4 mr-2" />
              Print Receipt
            </Button>
          )}
        </div>

        <Card>
          <CardHeader className="pb-4 border-b border-gray-100 dark:border-gray-700">
            {/* Status banner for non-completed payments */}
            {payment.status === "pending" && (
              <div className="mb-4 flex items-center gap-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
                <Clock className="h-4 w-4 flex-shrink-0" />
                <span>Payment is pending. You will be notified once confirmed.</span>
              </div>
            )}
            {payment.status === "failed" && (
              <div className="mb-4 flex items-center justify-between rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 px-4 py-3 text-sm text-red-800 dark:text-red-300">
                <div className="flex items-center gap-2">
                  <XCircle className="h-4 w-4 flex-shrink-0" />
                  <span>Payment failed. {payment.failed_reason ? `Reason: ${payment.failed_reason}` : "Please try again."}</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => retryMutation.mutate()}
                  isLoading={retryMutation.isPending}
                  className="ml-4 flex-shrink-0"
                >
                  <RefreshCw className="h-3.5 w-3.5 mr-1" />
                  Retry
                </Button>
              </div>
            )}
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <CreditCard className="h-5 w-5 text-primary-600" />
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Payment Receipt
                  </h1>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Receipt #{payment.display_id ?? payment.id.slice(0, 8).toUpperCase()}
                </p>
              </div>
              <Badge variant={statusInfo.variant} className="flex items-center gap-1.5 text-sm px-3 py-1.5">
                {statusInfo.icon}
                {statusInfo.label}
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="space-y-6 pt-6">

            {/* Total amount — prominent hero */}
            <div className="rounded-xl bg-gradient-to-br from-primary-50 to-indigo-100 dark:from-primary-900/30 dark:to-indigo-900/20 border border-primary-100 dark:border-primary-800 p-5 text-center">
              <p className="text-xs font-semibold uppercase tracking-widest text-primary-600 dark:text-primary-400 mb-1">
                {payment.status === "completed" ? "Total Charged" : "Amount"}
              </p>
              <p className="text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                {formatCurrency(payment.amount)}
              </p>
              {payment.status === "completed" && payment.paid_at && (
                <p className="mt-1.5 text-xs text-primary-700 dark:text-primary-300">
                  Paid on {paid.date} at {paid.time}
                </p>
              )}
            </div>

            {/* Service / Job info */}
            <div className="rounded-lg bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <Tag className="h-3.5 w-3.5 text-gray-400" />
                    <span className="text-xs font-medium uppercase tracking-wide text-gray-400">
                      {categoryName ?? "Service"}
                    </span>
                  </div>
                  <p className="font-semibold text-gray-900 dark:text-white leading-snug">
                    {jobTitle}
                  </p>
                </div>
                {job && (
                  <button
                    className="flex-shrink-0 text-xs text-primary-600 dark:text-primary-400 hover:underline font-medium"
                    onClick={() => router.push(ROUTES.DASHBOARD_JOB_DETAIL(job.id))}
                  >
                    View Job →
                  </button>
                )}
              </div>
              {/* Provider / customer party info */}
              {(providerName || providerBusiness) && (
                <div className="flex items-center gap-2 pt-1 border-t border-gray-200 dark:border-gray-700 mt-2">
                  <Building2 className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                  <span className="text-xs text-gray-600 dark:text-gray-300">
                    Provider:{" "}
                    <span className="font-medium text-gray-900 dark:text-white">
                      {providerBusiness ?? providerName}
                    </span>
                    {providerBusiness && providerName && (
                      <span className="text-gray-400"> · {providerName}</span>
                    )}
                  </span>
                </div>
              )}
              {user?.role === "provider" && (customerName || customerEmail) && (
                <div className="flex items-center gap-2">
                  <User2 className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                  <span className="text-xs text-gray-600 dark:text-gray-300">
                    Customer:{" "}
                    <span className="font-medium text-gray-900 dark:text-white">
                      {customerName ?? customerEmail}
                    </span>
                  </span>
                </div>
              )}
            </div>

            {/* Amount breakdown */}
            <div>
              <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-widest">
                Amount Breakdown
              </h3>
              <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden text-sm divide-y divide-gray-100 dark:divide-gray-700">
                <div className="flex justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800/40">
                  <span className="text-gray-600 dark:text-gray-400">Service Amount</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {formatCurrency(providerAmount)}
                  </span>
                </div>
                {/* Provider sees Platform Fee (not GST); Customer sees GST (not Platform Fee) */}
                {user?.role === "provider" ? (
                  <div className="flex justify-between px-4 py-3">
                    <span className="text-gray-600 dark:text-gray-400">Platform Fee</span>
                    <span className="font-medium text-red-500">
                      -{formatCurrency(platformFee)}
                    </span>
                  </div>
                ) : (
                  <div className="flex justify-between px-4 py-3">
                    <span className="text-gray-600 dark:text-gray-400">
                      GST <span className="text-xs">({gstRate}% on service fee)</span>
                    </span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {formatCurrency(gst)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between px-4 py-3 bg-primary-50 dark:bg-primary-900/20">
                  <span className="font-bold text-gray-900 dark:text-white">Total Charged</span>
                  <span className="font-extrabold text-primary-700 dark:text-primary-300">
                    {formatCurrency(payment.amount)}
                  </span>
                </div>
                {/* Provider payout — visible to providers */}
                {user?.role === "provider" && providerAmount > 0 && (
                  <div className="flex justify-between px-4 py-3 bg-emerald-50 dark:bg-emerald-900/20">
                    <span className="flex items-center gap-1.5 font-medium text-emerald-800 dark:text-emerald-300">
                      <Banknote className="h-3.5 w-3.5" />
                      Your Payout
                    </span>
                    <span className="font-bold text-emerald-700 dark:text-emerald-300">
                      {formatCurrency(providerAmount)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Payment details grid */}
            <div>
              <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-widest">
                Payment Details
              </h3>
              <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden text-sm divide-y divide-gray-100 dark:divide-gray-700">
                {/* Paid date/time */}
                <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800/40">
                  <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>{payment.paid_at ? "Paid On" : "Created On"}</span>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-gray-900 dark:text-white">{paid.date}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{paid.time} · {formatRelativeTime(receiptDate)}</p>
                  </div>
                </div>
                {/* Created at (if different from paid_at) */}
                {payment.paid_at && payment.paid_at !== payment.created_at && (
                  <div className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                      <Calendar className="h-3.5 w-3.5" />
                      <span>Initiated On</span>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-gray-900 dark:text-white">{created.date}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{created.time}</p>
                    </div>
                  </div>
                )}
                {/* Payment method */}
                {payment.payment_method && (
                  <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800/40">
                    <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                      <CreditCard className="h-3.5 w-3.5" />
                      <span>Method</span>
                    </div>
                    <span className="font-medium text-gray-900 dark:text-white capitalize">
                      {payment.payment_method.replace(/_/g, " ")}
                    </span>
                  </div>
                )}
                {/* Gateway */}
                {payment.gateway && payment.gateway !== "cash" && (
                  <div className="flex items-center justify-between px-4 py-3">
                    <span className="text-gray-500 dark:text-gray-400">Gateway</span>
                    <span className="font-medium text-gray-900 dark:text-white capitalize">
                      {payment.gateway}
                    </span>
                  </div>
                )}
                {/* Transaction ID with copy button */}
                {payment.transaction_id && (
                  <div className="flex items-center justify-between gap-3 px-4 py-3 bg-gray-50 dark:bg-gray-800/40">
                    <span className="text-gray-500 dark:text-gray-400 flex-shrink-0">Transaction ID</span>
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-mono text-xs text-gray-700 dark:text-gray-300 truncate">
                        {payment.transaction_id}
                      </span>
                      <button
                        title="Copy transaction ID"
                        onClick={() => copyToClipboard(payment.transaction_id!)}
                        className="flex-shrink-0 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                      >
                        {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>
                )}
                {/* Payment / Receipt ID */}
                <div className="flex items-center justify-between gap-3 px-4 py-3">
                  <span className="text-gray-500 dark:text-gray-400 flex-shrink-0">Payment ID</span>
                  <span className="font-mono text-xs text-gray-700 dark:text-gray-300">
                    {payment.display_id ?? payment.id.slice(0, 12).toUpperCase()}
                  </span>
                </div>
              </div>
            </div>

            {/* Invoice download */}
            {payment.invoice_url && (
              <div className="print:hidden bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-blue-900 dark:text-blue-200">Invoice Ready</p>
                    <p className="text-xs text-blue-700 dark:text-blue-400">Your auto-generated invoice is available to download</p>
                  </div>
                </div>
                <a
                  href={payment.invoice_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-shrink-0 flex items-center gap-1.5 text-sm font-semibold text-blue-700 dark:text-blue-300 hover:underline"
                >
                  View Invoice
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap gap-3 pt-2 print:hidden">
              {user?.role === "customer" && (
                <Button
                  variant="outline"
                  onClick={() => router.push(ROUTES.DASHBOARD_PAYMENT_HISTORY)}
                >
                  Payment History
                </Button>
              )}
              {user?.role === "provider" && (
                <Button
                  variant="outline"
                  onClick={() => router.push(ROUTES.DASHBOARD_EARNINGS)}
                >
                  Earnings
                </Button>
              )}
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
    <ProtectedRoute requiredPermissions={["payments.read"]}>
      <PaymentReceiptContent />
    </ProtectedRoute>
  );
}
