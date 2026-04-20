"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useRealtimeDetail } from "@/hooks/useRealtimeDetail";
import { usePublicSettings } from "@/hooks/usePublicSettings";
import { Layout } from "@/components/layout/Layout";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Loading } from "@/components/ui/Loading";
import { StatusBadge } from "@/components/ui/Badge";
import { ErrorState } from "@/components/ui/ErrorState";
import { ProtectedRoute } from "@/components/shared/ProtectedRoute";
import { jobService } from "@/services/job-service";
import { paymentService } from "@/services/payment-service";
import { getJobReview } from "@/services/review-service";
import { ROUTES } from "@/config/constants";
import { formatCurrency, formatRelativeTime, formatDateTime, formatDate } from "@/utils/helpers";
import { ArrowLeft, Briefcase, Calendar, User, IndianRupee, Clock, AlertTriangle, Play, CheckCircle, XCircle, CreditCard, Star, Tag, Phone, Mail, FileText, BadgeCheck, TrendingUp, Banknote, Info } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import Link from "next/link";
import toast from "react-hot-toast";

function InfoRow({ label, value, className }: { label: string; value: React.ReactNode; className?: string }) {
  return (
    <div className={`flex justify-between items-start gap-4 ${className ?? ""}`}>
      <span className="text-sm text-gray-500 dark:text-gray-400 shrink-0">{label}</span>
      <span className="text-sm font-medium text-gray-900 dark:text-white text-right">{value}</span>
    </div>
  );
}
function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-3">{children}</p>;
}

type TimelineColor = "green" | "blue" | "emerald" | "primary" | "amber" | "red";
const colorMap: Record<TimelineColor, { ring: string; icon: string }> = {
  green:   { ring: "bg-green-100 dark:bg-green-900/40",     icon: "text-green-600 dark:text-green-400" },
  blue:    { ring: "bg-blue-100 dark:bg-blue-900/40",       icon: "text-blue-600 dark:text-blue-400" },
  emerald: { ring: "bg-emerald-100 dark:bg-emerald-900/40", icon: "text-emerald-600 dark:text-emerald-400" },
  primary: { ring: "bg-primary-100 dark:bg-primary-900/40", icon: "text-primary-600 dark:text-primary-400" },
  amber:   { ring: "bg-amber-100 dark:bg-amber-900/40",     icon: "text-amber-500" },
  red:     { ring: "bg-red-100 dark:bg-red-900/40",         icon: "text-red-500 dark:text-red-400" },
};
function TimelineItem({ done, icon, color, title, subtitle, detail }: {
  done: boolean; icon: React.ReactNode; color: TimelineColor;
  title: string; subtitle?: string; detail?: string | null;
}) {
  const c = colorMap[color];
  return (
    <li className="ml-6">
      <span className={`absolute -left-3 flex h-6 w-6 items-center justify-center rounded-full ring-4 ring-white dark:ring-gray-900 ${done ? c.ring : "bg-gray-100 dark:bg-gray-800"}`}>
        <span className={done ? c.icon : "text-gray-400"}>{icon}</span>
      </span>
      <p className={`text-sm font-medium ${done ? "text-gray-900 dark:text-white" : "text-gray-400 dark:text-gray-500"}`}>{title}</p>
      {subtitle && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{subtitle}</p>}
      {detail && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 italic">{detail}</p>}
    </li>
  );
}

export default function JobDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { config: siteConfig } = usePublicSettings();
  const jobId = params.id as string;

  useRealtimeDetail(["job:created", "job:updated", "job:completed", "job:deleted", "dispute:created"], ["job", jobId], jobId);
  useRealtimeDetail(["payment:completed", "payment:created", "payment:updated", "payment:failed", "payment:refunded"], ["job-payments", jobId], jobId);
  useRealtimeDetail(["review:created"], ["job-review", jobId], jobId);

  const { data: job, isLoading, error } = useQuery({
    queryKey: ["job", jobId],
    queryFn: () => jobService.getJobById(jobId),
    enabled: isAuthenticated && !!jobId,
  });

  const { data: jobPayments } = useQuery({
    queryKey: ["job-payments", jobId],
    queryFn: () => paymentService.getPaymentsByJob(jobId),
    enabled: isAuthenticated && !!jobId,
  });

  const { data: existingReview } = useQuery({
    queryKey: ["job-review", jobId],
    queryFn: () => getJobReview(jobId).catch(() => null),
    enabled: isAuthenticated && !!jobId && !!job && job.status === "completed",
  });

  const startJobMutation = useMutation({
    mutationFn: () => jobService.startJob(jobId),
    onSuccess: () => { toast.success("Job started!"); queryClient.invalidateQueries({ queryKey: ["job", jobId] }); },
    onError: () => toast.error("Failed to start job"),
  });

  const completeJobMutation = useMutation({
    mutationFn: () => jobService.completeJob(jobId),
    onSuccess: () => { toast.success("Job marked as completed!"); queryClient.invalidateQueries({ queryKey: ["job", jobId] }); },
    onError: () => toast.error("Failed to complete job"),
  });

  const customerCompleteJobMutation = useMutation({
    mutationFn: () => jobService.completeJobByCustomer(jobId),
    onSuccess: () => { toast.success("Job completed!"); queryClient.invalidateQueries({ queryKey: ["job", jobId] }); queryClient.invalidateQueries({ queryKey: ["job-payments", jobId] }); },
    onError: (err: any) => toast.error(err?.response?.data?.message || "Failed to complete job"),
  });

  const cancelJobMutation = useMutation({
    mutationFn: (reason: string) => jobService.cancelJob(jobId, reason),
    onSuccess: () => {
      toast.success("Job cancelled"); setShowCancelDialog(false); setCancelReason("");
      queryClient.invalidateQueries({ queryKey: ["job", jobId] });
    },
    onError: () => toast.error("Failed to cancel job"),
  });

  const cashPaymentMutation = useMutation({
    mutationFn: (amount: number) => paymentService.confirmCashPayment(jobId, job!.provider_id, amount),
    onSuccess: () => {
      toast.success("Cash payment confirmed!");
      setShowCashPaymentDialog(false);
      setCashPaymentAmount("");
      queryClient.invalidateQueries({ queryKey: ["job-payments", jobId] });
      queryClient.invalidateQueries({ queryKey: ["job", jobId] });
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || "Failed to confirm cash payment"),
  });

  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [showCashPaymentDialog, setShowCashPaymentDialog] = useState(false);
  const [cashPaymentAmount, setCashPaymentAmount] = useState("");

  const completedPayment = jobPayments?.find((p) => p.status === "completed");
  const hasCompletedPayment = !!completedPayment;

  if (authLoading || isLoading) return <Layout><div className="container-custom py-8"><Loading /></div></Layout>;
  if (error || !job) return <Layout><div className="container-custom py-8"><ErrorState title="Job not found" message="We couldn't find this job or you don't have permission to view it." retry={() => router.push(ROUTES.DASHBOARD_JOBS)} /></div></Layout>;

  const isProvider = user?.id === job.provider_id;
  const isCustomer = user?.id === job.customer_id;
  const displayProviderName = job.provider_name || job.provider_business_name || job.provider?.name || job.provider?.business_name || "Provider";
  const displayCustomerName = job.customer_name || job.customer?.name || "Customer";
  const requestBudget = job.request_budget ?? 0;
  const proposalPrice = job.proposal_price ?? job.actual_amount ?? 0;
  const agreedAmount = job.actual_amount ?? proposalPrice;
  const pb = job.price_breakdown;

  return (
    <ProtectedRoute requiredPermissions={["jobs.read"]}>
      <Layout>
        <div className="container-custom py-8 mx-auto">
          <Link href={ROUTES.DASHBOARD_JOBS} className="inline-flex items-center text-primary-600 hover:text-primary-700 mb-6 text-sm">
            <ArrowLeft className="h-4 w-4 mr-2" />Back to My Jobs
          </Link>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
                Job #{job.display_id || job.id.slice(0, 8).toUpperCase()}
              </h1>
              <div className="flex flex-wrap items-center gap-3 text-gray-500 dark:text-gray-400 text-sm">
                <span className="flex items-center gap-1"><Calendar className="h-4 w-4" />Created {formatRelativeTime(job.created_at)}</span>
                {job.request_category_name && (
                  <span className="flex items-center gap-1 px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-xs font-medium">
                    <Tag className="h-3 w-3" />{job.request_category_name}
                  </span>
                )}
                <StatusBadge status={job.status} />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {isProvider && (job.status === "pending" || job.status === "scheduled") && (
                <Button onClick={() => startJobMutation.mutate()} isLoading={startJobMutation.isPending} className="bg-green-600 hover:bg-green-700">
                  <Play className="h-4 w-4 mr-2" />Start Job
                </Button>
              )}
              {isProvider && job.status === "in_progress" && (
                <Button onClick={() => completeJobMutation.mutate()} isLoading={completeJobMutation.isPending} className="bg-primary-600 hover:bg-primary-700">
                  <CheckCircle className="h-4 w-4 mr-2" />Mark as Completed
                </Button>
              )}
              {isCustomer && hasCompletedPayment && job.status !== "completed" && job.status !== "cancelled" && (
                <Button onClick={() => customerCompleteJobMutation.mutate()} isLoading={customerCompleteJobMutation.isPending} className="bg-primary-600 hover:bg-primary-700">
                  <CheckCircle className="h-4 w-4 mr-2" />Mark as Completed
                </Button>
              )}
              {isCustomer && (job.status === "pending" || job.status === "scheduled" || job.status === "in_progress") && !hasCompletedPayment && (
                <Button
                  onClick={() => {
                    setCashPaymentAmount(agreedAmount > 0 ? String(agreedAmount) : "");
                    setShowCashPaymentDialog(true);
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  <Banknote className="h-4 w-4 mr-2" />Pay {pb ? formatCurrency(pb.total_payable) : "Cash"}
                </Button>
              )}
              {isCustomer && job.status === "completed" && !existingReview && (
                <Button onClick={() => router.push(`${ROUTES.DASHBOARD_REVIEW_SUBMIT}?jobId=${jobId}&providerId=${job.provider_id}`)} className="bg-amber-500 hover:bg-amber-600">
                  <Star className="h-4 w-4 mr-2" />Leave Review
                </Button>
              )}
              {isCustomer && job.status === "completed" && existingReview && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 text-sm font-medium text-amber-700 dark:text-amber-300">
                  <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                  You rated {existingReview.rating}/5
                </div>
              )}
              {(isProvider || isCustomer) && job.status === "pending" && (
                <Button variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => setShowCancelDialog(true)} isLoading={cancelJobMutation.isPending}>
                  <XCircle className="h-4 w-4 mr-2" />Cancel Job
                </Button>
              )}
              {isCustomer && (job.status === "in_progress" || job.status === "completed") && (
                <Button variant="outline" className="text-amber-600 border-amber-200 hover:bg-amber-50" onClick={() => router.push(`${ROUTES.DASHBOARD_DISPUTE_FILE}?jobId=${jobId}`)}>
                  <AlertTriangle className="h-4 w-4 mr-2" />File Dispute
                </Button>
              )}

            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">

              <Card>
                <CardHeader>
                  <h2 className="text-lg font-semibold flex items-center gap-2"><FileText className="h-5 w-5 text-primary-500" />Service Request</h2>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <SectionLabel>Description</SectionLabel>
                    <p className="text-gray-900 dark:text-gray-100 whitespace-pre-wrap leading-relaxed">
                      {job.request_description || job.request?.description || "No description provided"}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Customer Budget</p>
                      <p className="text-base font-semibold text-gray-900 dark:text-white">{formatCurrency(requestBudget)}</p>
                    </div>
                    {job.request_urgency && (
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Urgency</p>
                        <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded capitalize
                          ${job.request_urgency === "urgent" ? "bg-red-100 text-red-700" :
                            job.request_urgency === "high" ? "bg-orange-100 text-orange-700" :
                            job.request_urgency === "medium" ? "bg-yellow-100 text-yellow-700" :
                            "bg-gray-100 text-gray-600"}`}>{job.request_urgency}</span>
                      </div>
                    )}
                    {job.request_preferred_date && (
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Preferred Date</p>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{formatDate(job.request_preferred_date)}</p>
                      </div>
                    )}
                    {job.request_category_name && (
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Category</p>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {job.request_category_icon && <span className="mr-1">{job.request_category_icon}</span>}
                          {job.request_category_name}
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <h2 className="text-lg font-semibold flex items-center gap-2"><IndianRupee className="h-5 w-5 text-primary-500" />Pricing Breakdown</h2>
                </CardHeader>
                <CardContent className="space-y-3">
                  <InfoRow label="Customer Budget" value={formatCurrency(requestBudget)} />
                  {proposalPrice > 0 && (
                    <InfoRow label="Provider Offer (Proposal)" value={<span className="text-blue-600 dark:text-blue-400">{formatCurrency(proposalPrice)}</span>} />
                  )}
                  {job.proposal_estimated_hours && (
                    <InfoRow label="Estimated Duration" value={`${job.proposal_estimated_hours} hr${job.proposal_estimated_hours !== 1 ? "s" : ""}`} />
                  )}
                  <div className="pt-3 border-t border-gray-100 dark:border-gray-800">
                    <InfoRow label="Agreed / Final Amount" value={<span className="text-lg font-bold text-primary-600">{formatCurrency(agreedAmount)}</span>} />
                  </div>

                  {/* --- Customer sees Service Amount + GST + total (urgency baked into Service Amount); Provider sees earnings --- */}
                  {pb && isCustomer && (
                    <div className="pt-2 space-y-2 text-xs">
                      <InfoRow label="Service Amount" value={formatCurrency(pb.subtotal)} />
                      <InfoRow label={`GST (${siteConfig.gstRate}% on service fee)`} value={formatCurrency(pb.gst_amount)} />
                      <div className="pt-2 border-t border-dashed border-gray-200 dark:border-gray-700">
                        <InfoRow label="Total Payable (incl. GST)" value={<span className="text-base font-bold text-green-600 dark:text-green-400">{formatCurrency(pb.total_payable)}</span>} />
                      </div>
                    </div>
                  )}
                  {pb && isProvider && (
                    <div className="pt-2 space-y-2 text-xs">
                      <InfoRow label={`Platform Fee (${pb.platform_fee_percent}%)`} value={<span className="text-red-500">-{formatCurrency(pb.platform_fee)}</span>} />
                      <div className="pt-2 border-t border-dashed border-gray-200 dark:border-gray-700">
                        <InfoRow label="You will receive" value={<span className="text-base font-bold text-green-600 dark:text-green-400">{formatCurrency(pb.provider_amount)}</span>} />
                      </div>
                    </div>
                  )}
                  <div className="pt-3 border-t border-gray-100 dark:border-gray-800 space-y-2">
                    <InfoRow
                      label="Payment Status"
                      value={hasCompletedPayment
                        ? <span className="text-green-600 font-semibold flex items-center gap-1"><CheckCircle className="h-4 w-4" />Paid</span>
                        : <span className="text-amber-600 font-medium">Awaiting Payment</span>}
                    />
                    {completedPayment && <InfoRow label="Payment Method" value={<span className="capitalize">{completedPayment.payment_method || "Cash"}</span>} />}
                    {completedPayment && (
                      <button onClick={() => router.push(ROUTES.DASHBOARD_PAYMENT_RECEIPT(completedPayment.id))} className="text-xs text-primary-600 hover:underline mt-1 block">
                        View Receipt ?
                      </button>
                    )}
                  </div>
                </CardContent>
              </Card>

              {job.proposal_message && (
                <Card>
                  <CardHeader>
                    <h2 className="text-lg font-semibold flex items-center gap-2"><Info className="h-5 w-5 text-primary-500" />Proposal Details</h2>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <SectionLabel>Provider Message</SectionLabel>
                      <p className="text-gray-800 dark:text-gray-200 text-sm whitespace-pre-wrap leading-relaxed">{job.proposal_message}</p>
                    </div>
                    {(job.proposal_start_date || job.proposal_completion_date) && (
                      <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                        {job.proposal_start_date && (
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Proposed Start</p>
                            <p className="text-sm font-medium">{formatDate(job.proposal_start_date)}</p>
                          </div>
                        )}
                        {job.proposal_completion_date && (
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Proposed Completion</p>
                            <p className="text-sm font-medium">{formatDate(job.proposal_completion_date)}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {job.status === "cancelled" && job.cancellation_reason && (
                <Card className="border-red-100 bg-red-50/30 dark:bg-red-900/10">
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                      <div>
                        <h3 className="text-sm font-semibold text-red-800 dark:text-red-200">Cancellation Reason</h3>
                        <p className="text-sm text-red-700 dark:text-red-300 mt-1">{job.cancellation_reason}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {existingReview && (
                <Card className="border-amber-100 dark:border-amber-800/40">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <h2 className="text-lg font-semibold flex items-center gap-2">
                        <Star className="h-5 w-5 text-amber-400 fill-amber-400" />
                        Your Review
                      </h2>
                      <span className="text-xs text-gray-400 dark:text-gray-500">{formatRelativeTime(existingReview.created_at)}</span>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {/* Star rating */}
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`h-5 w-5 ${
                            star <= existingReview.rating
                              ? "text-amber-400 fill-amber-400"
                              : "text-gray-200 dark:text-gray-700"
                          }`}
                        />
                      ))}
                      <span className="ml-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
                        {existingReview.rating}/5
                      </span>
                    </div>
                    {/* Comment */}
                    {existingReview.comment && (
                      <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-wrap">
                        {existingReview.comment}
                      </p>
                    )}
                    {/* Provider response */}
                    {existingReview.response && (
                      <div className="mt-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700 p-3">
                        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Provider Response</p>
                        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{existingReview.response}</p>
                        {existingReview.response_at && (
                          <p className="text-xs text-gray-400 mt-1">{formatRelativeTime(existingReview.response_at)}</p>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <h2 className="text-lg font-semibold flex items-center gap-2"><Clock className="h-5 w-5 text-primary-500" />Timeline</h2>
                </CardHeader>
                <CardContent>
                  <ol className="relative border-l border-gray-200 dark:border-gray-700 ml-3 space-y-6">
                    <TimelineItem done icon={<Briefcase className="h-3.5 w-3.5" />} color="green" title="Job Created" subtitle={formatDateTime(job.created_at)} detail={`Request #${job.request_id?.slice(0, 8).toUpperCase()}`} />
                    <TimelineItem done={!!job.started_at} icon={<Play className="h-3.5 w-3.5" />} color="blue" title="Job Started" subtitle={job.started_at ? formatDateTime(job.started_at) : "Pending provider action"} />
                    <TimelineItem done={hasCompletedPayment} icon={<CreditCard className="h-3.5 w-3.5" />} color="emerald" title="Payment Confirmed"
                      subtitle={hasCompletedPayment ? `${formatCurrency(agreedAmount)} via ${completedPayment?.payment_method || "cash"}` : "Awaiting customer payment"} />
                    <TimelineItem done={!!job.completed_at} icon={<CheckCircle className="h-3.5 w-3.5" />} color="primary" title="Job Completed" subtitle={job.completed_at ? formatDateTime(job.completed_at) : "Pending"} />
                    {job.status === "cancelled" && (
                      <TimelineItem done icon={<XCircle className="h-3.5 w-3.5" />} color="red" title="Job Cancelled"
                        subtitle={job.updated_at ? formatDateTime(job.updated_at) : ""} detail={job.cancellation_reason} />
                    )}
                    <TimelineItem done={!!existingReview} icon={<Star className="h-3.5 w-3.5" />} color="amber" title="Review"
                      subtitle={existingReview
                        ? `Rated ${existingReview.rating}/5 — ${formatRelativeTime(existingReview.created_at)}`
                        : job.status === "completed"
                          ? isCustomer ? "You can leave a review" : "Customer can leave a review"
                          : "Available after completion"} />
                  </ol>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <h3 className="text-base font-semibold flex items-center gap-2"><User className="h-4 w-4 text-gray-400" />Customer</h3>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                      <span className="text-sm font-bold text-blue-600 dark:text-blue-300">{displayCustomerName.charAt(0).toUpperCase()}</span>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white text-sm">{displayCustomerName}</p>
                      <p className="text-xs text-gray-500">Customer</p>
                    </div>
                  </div>
                  {job.customer_email && <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400"><Mail className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{job.customer_email}</span></div>}
                  {job.customer_phone && <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400"><Phone className="h-3.5 w-3.5 shrink-0" /><span>{job.customer_phone}</span></div>}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <h3 className="text-base font-semibold flex items-center gap-2"><Briefcase className="h-4 w-4 text-gray-400" />Provider</h3>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center shrink-0">
                      <span className="text-sm font-bold text-primary-600 dark:text-primary-300">{displayProviderName.charAt(0).toUpperCase()}</span>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white text-sm">{displayProviderName}</p>
                      {job.provider_business_name && job.provider_name && <p className="text-xs text-gray-500">{job.provider_business_name}</p>}
                    </div>
                  </div>
                  {job.provider_rating != null && (
                    <div className="flex items-center gap-1 text-sm">
                      <Star className="h-4 w-4 text-amber-400 fill-amber-400" />
                      <span className="font-semibold text-gray-900 dark:text-white">{Number(job.provider_rating).toFixed(1)}</span>
                      <span className="text-xs text-gray-500">rating</span>
                    </div>
                  )}
                  {job.provider_verification_status && (
                    <div className="flex items-center gap-1.5 text-xs">
                      <BadgeCheck className={`h-4 w-4 ${job.provider_verification_status === "verified" ? "text-green-500" : "text-gray-400"}`} />
                      <span className={`capitalize font-medium ${job.provider_verification_status === "verified" ? "text-green-600" : "text-gray-500"}`}>{job.provider_verification_status}</span>
                    </div>
                  )}
                  {job.provider_email && <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400"><Mail className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{job.provider_email}</span></div>}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <h3 className="text-base font-semibold flex items-center gap-2"><TrendingUp className="h-4 w-4 text-gray-400" />Job Summary</h3>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <InfoRow label="Status" value={<StatusBadge status={job.status} />} />
                  <InfoRow label="Created" value={formatRelativeTime(job.created_at)} />
                  {job.started_at && <InfoRow label="Started" value={formatDateTime(job.started_at)} />}
                  {job.completed_at && <InfoRow label="Completed" value={formatDateTime(job.completed_at)} />}
                  <div className="pt-3 border-t border-gray-100 dark:border-gray-800 space-y-2">
                    <InfoRow label="Budget" value={formatCurrency(requestBudget)} />
                    {proposalPrice > 0 && <InfoRow label="Offer Price" value={<span className="text-blue-600">{formatCurrency(proposalPrice)}</span>} />}
                    <InfoRow label="Final Amount" value={<span className="font-bold text-primary-600 text-base">{formatCurrency(agreedAmount)}</span>} />
                  </div>
                  <div className="pt-3 border-t border-gray-100 dark:border-gray-800">
                    <InfoRow
                      label="Payment"
                      value={hasCompletedPayment
                        ? <button onClick={() => router.push(ROUTES.DASHBOARD_PAYMENT_RECEIPT(completedPayment!.id))} className="text-green-600 font-medium text-xs px-2 py-0.5 bg-green-50 dark:bg-green-900/20 rounded-full hover:underline">Paid - Receipt</button>
                        : <span className="text-amber-600 text-xs font-medium px-2 py-0.5 bg-amber-50 dark:bg-amber-900/20 rounded-full">Pending</span>}
                    />
                    {completedPayment?.payment_method && <InfoRow label="Method" value={<span className="capitalize">{completedPayment.payment_method}</span>} className="mt-2" />}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </Layout>

      <Modal isOpen={showCashPaymentDialog} onClose={() => { setShowCashPaymentDialog(false); setCashPaymentAmount(""); }} title="Confirm Cash Payment" size="sm">
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">Confirm the cash payment for this job.</p>
        {pb && (
          <div className="rounded-lg border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 p-3 space-y-1.5 text-xs mb-4">
            <div className="flex justify-between">
              <span className="text-gray-500">Service Amount</span>
              <span className="font-medium text-gray-900 dark:text-gray-100">{formatCurrency(pb.subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">GST ({siteConfig.gstRate}% on service fee)</span>
              <span className="font-medium text-gray-700 dark:text-gray-300">{formatCurrency(pb.gst_amount)}</span>
            </div>
            <div className="flex justify-between pt-1.5 border-t border-dashed border-gray-200 dark:border-gray-700">
              <span className="font-semibold text-gray-900 dark:text-gray-100">Total Payable</span>
              <span className="font-bold text-green-600 dark:text-green-400">{formatCurrency(pb.total_payable)}</span>
            </div>
          </div>
        )}
        {!pb && agreedAmount > 0 && (
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">Agreed amount: <span className="font-semibold text-gray-700 dark:text-gray-300">{formatCurrency(agreedAmount)}</span></p>
        )}
        <div className="flex justify-end gap-3 mt-4">
          <Button variant="outline" size="sm" onClick={() => { setShowCashPaymentDialog(false); setCashPaymentAmount(""); }}>Cancel</Button>
          <Button
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-700"
            isLoading={cashPaymentMutation.isPending}
            disabled={agreedAmount <= 0}
            onClick={() => cashPaymentMutation.mutate(agreedAmount)}
          >
            <Banknote className="h-4 w-4 mr-2" />Confirm Payment
          </Button>
        </div>
      </Modal>

      <Modal isOpen={showCancelDialog} onClose={() => { setShowCancelDialog(false); setCancelReason(""); }} title="Cancel Job" size="sm">
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Please provide a reason for cancelling this job.</p>
        <textarea
          className="w-full border border-gray-300 dark:border-gray-600 rounded-lg p-3 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
          rows={3} placeholder="Reason for cancellation..." value={cancelReason}
          onChange={(e) => setCancelReason(e.target.value)}
        />
        <div className="flex justify-end gap-3 mt-4">
          <Button variant="outline" size="sm" onClick={() => { setShowCancelDialog(false); setCancelReason(""); }}>Back</Button>
          <Button size="sm" className="bg-red-600 hover:bg-red-700" isLoading={cancelJobMutation.isPending} disabled={!cancelReason.trim()} onClick={() => cancelJobMutation.mutate(cancelReason.trim())}>
            Confirm Cancel
          </Button>
        </div>
      </Modal>
    </ProtectedRoute>
  );
}
