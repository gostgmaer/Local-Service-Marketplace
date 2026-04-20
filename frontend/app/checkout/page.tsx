"use client";

import { useEffect, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { Permission } from "@/utils/permissions";
import { ROUTES } from "@/config/constants";
import { Layout } from "@/components/layout/Layout";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Loading } from "@/components/ui/Loading";
import { paymentService, PricingPlan, SavedPaymentMethod } from "@/services/payment-service";
import { getProviderProfileByUserId } from "@/services/user-service";
import { jobService } from "@/services/job-service";
import { usePublicSettings } from "@/hooks/usePublicSettings";
import { formatCurrency } from "@/utils/helpers";
import {
  AlertCircle,
  CheckCircle,
  CreditCard,
  ArrowLeft,
  Briefcase,
  Tag,
  Banknote,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";

// â”€â”€â”€ Job Payment Flow â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function JobCheckout({ jobId }: { jobId: string }) {
  const router = useRouter();
  const { user } = useAuth();
  const { config: siteConfig } = usePublicSettings();
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string;
    discountPercent: number;
  } | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<string>("cash");

  const { data: job, isLoading } = useQuery({
    queryKey: ["job", jobId],
    queryFn: () => jobService.getJobById(jobId),
    enabled: !!jobId,
  });

  const { data: savedMethods = [] } = useQuery({
    queryKey: ["payment-methods"],
    queryFn: () => paymentService.getPaymentMethods(),
  });

  // Auto-select the default saved payment method when loaded
  useEffect(() => {
    const defaultMethod = savedMethods.find((m) => m.is_default);
    if (defaultMethod && selectedMethod === "cash") {
      setSelectedMethod(defaultMethod.id);
    }
  }, [savedMethods]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleApplyCoupon = async () => {
    const code = couponCode.trim();
    if (!code) return;
    setCouponError(null);
    setCouponLoading(true);
    try {
      const result = await paymentService.previewCoupon(code);
      setAppliedCoupon({ code, discountPercent: result.discount_percent });
    } catch (err: any) {
      const msg =
        err?.response?.data?.message || err?.message || "Invalid coupon code";
      setCouponError(msg);
      setAppliedCoupon(null);
    } finally {
      setCouponLoading(false);
    }
  };

  const payMutation = useMutation({
    mutationFn: async () => {
      if (!job) throw new Error("Job not found");
      // Always send base amount — the payment service applies urgency surcharge,
      // platform fee, and GST internally.
      const baseAmount = job.actual_amount || 0;
      if (selectedMethod === "cash") {
        return paymentService.confirmCashPayment(
          job.id,
          job.provider_id || (job as any)?.provider?.id || "",
          baseAmount,
        );
      }
      return paymentService.createPayment({
        job_id: job.id,
        provider_id: job.provider_id || (job as any)?.provider?.id || "",
        amount: baseAmount,
        currency: "INR",
        payment_method: selectedMethod,
        ...(appliedCoupon ? { coupon_code: appliedCoupon.code } : {}),
      });
    },
    onSuccess: () => {
      toast.success("Payment processed successfully!");
      router.push(ROUTES.DASHBOARD_JOB_DETAIL(jobId));
    },
    onError: (err: any) => {
      const msg =
        err?.response?.data?.message || err?.message || "Payment failed";
      toast.error(msg);
    },
  });

  if (isLoading) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <Loading />
        </div>
      </Layout>
    );
  }

  if (!job) {
    return (
      <Layout>
        <div className="container-custom py-12 text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Job not found
          </h2>
          <Link href={ROUTES.DASHBOARD_JOBS}>
            <Button variant="outline">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Jobs
            </Button>
          </Link>
        </div>
      </Layout>
    );
  }

  // Ownership guard: only the customer who owns the job can pay for it
  if (user?.id && job.customer_id && user.id !== job.customer_id) {
    return (
      <Layout>
        <div className="container-custom py-12 text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Access Denied
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            You are not authorized to make a payment for this job.
          </p>
          <Link href={ROUTES.DASHBOARD_JOBS}>
            <Button variant="outline">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Jobs
            </Button>
          </Link>
        </div>
      </Layout>
    );
  }

  const amount = job.actual_amount || 0;
  const pb = job.price_breakdown;

  // Use backend price_breakdown if available; otherwise fall back to local calculation
  const discountedAmount = appliedCoupon
    ? Math.round(amount * (1 - appliedCoupon.discountPercent / 100) * 100) / 100
    : amount;
  const urgencySurcharge = pb?.urgency_surcharge ?? 0;
  const subtotal = pb ? Math.round((discountedAmount + urgencySurcharge) * 100) / 100 : discountedAmount;
  const platformFeeAmt = pb?.platform_fee ?? Math.floor(subtotal * siteConfig.platformFeePercentage / 100);
  const gstAmt = pb?.gst_amount ?? Math.round((platformFeeAmt * siteConfig.gstRate / 100) * 100) / 100;
  const totalDue = pb?.total_payable ?? Math.round((subtotal + gstAmt) * 100) / 100;

  return (
    <Layout>
      <div className="bg-gray-50 dark:bg-gray-900 min-h-screen py-12">
        <div className="max-w-2xl mx-auto px-4">
          <div className="mb-6">
            <Link
              href={ROUTES.DASHBOARD_JOB_DETAIL(jobId)}
              className="inline-flex items-center text-sm text-gray-600 dark:text-gray-400 hover:text-primary-600"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back to Job
            </Link>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">
            Pay for Job
          </h1>
          <div className="grid gap-6">
            {/* Job Summary */}
            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <Briefcase className="h-5 w-5 text-primary-600" />
                  Order Summary
                </h2>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white text-lg">
                      Job #
                      {(job as any).display_id ||
                        job.id.slice(0, 8).toUpperCase()}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 capitalize">
                      Status: {job.status}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-primary-600 dark:text-primary-400">
                      {formatCurrency(totalDue)}
                    </p>
                    <p className="text-sm text-gray-500">Total (incl. GST)</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Payment */}
            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                  <CreditCard className="w-5 h-5 mr-2" />
                  Payment
                </h2>
              </CardHeader>
              <CardContent>
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4 mb-6 text-sm text-blue-900 dark:text-blue-200">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                    <p>
                      This payment will be processed and funds released to the
                      provider. This action cannot be reversed.
                    </p>
                  </div>
                </div>
                {/* Coupon code */}
                <div className="mb-5">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1 mb-1">
                    <Tag className="h-4 w-4" />
                    Coupon Code{" "}
                    <span className="font-normal text-gray-400">(optional)</span>
                  </label>
                  {appliedCoupon ? (
                    <div className="flex items-center justify-between bg-green-50 dark:bg-green-900/20 border border-green-300 dark:border-green-700 rounded-lg px-3 py-2">
                      <span className="text-sm font-medium text-green-700 dark:text-green-400">
                        <CheckCircle className="inline h-4 w-4 mr-1" />
                        {appliedCoupon.code} — {appliedCoupon.discountPercent}% off applied
                      </span>
                      <button
                        type="button"
                        className="text-xs text-red-500 hover:underline ml-4"
                        onClick={() => { setAppliedCoupon(null); setCouponCode(""); }}
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          className="flex-1 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 uppercase"
                          placeholder="Enter coupon code"
                          value={couponCode}
                          onChange={(e) => { setCouponCode(e.target.value.toUpperCase()); setCouponError(null); }}
                          onKeyDown={(e) => e.key === "Enter" && handleApplyCoupon()}
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleApplyCoupon}
                          isLoading={couponLoading}
                          disabled={!couponCode.trim() || couponLoading}
                        >
                          Apply
                        </Button>
                      </div>
                      {couponError && (
                        <p className="mt-1 text-xs text-red-600 dark:text-red-400">{couponError}</p>
                      )}
                    </>
                  )}
                </div>
                {/* Payment Method Selector */}
                <div className="mb-5">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1 mb-2">
                    <Wallet className="h-4 w-4" />
                    Payment Method
                  </label>
                  <div className="space-y-2">
                    {/* Cash option — always available */}
                    <label
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedMethod === "cash"
                          ? "border-primary-500 bg-primary-50 dark:bg-primary-900/20"
                          : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                      }`}
                    >
                      <input
                        type="radio"
                        name="paymentMethod"
                        value="cash"
                        checked={selectedMethod === "cash"}
                        onChange={() => setSelectedMethod("cash")}
                        className="accent-primary-600"
                      />
                      <Banknote className="h-5 w-5 text-emerald-600 flex-shrink-0" />
                      <div className="flex-1">
                        <span className="text-sm font-medium text-gray-900 dark:text-white">Cash</span>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Pay directly to the service provider</p>
                      </div>
                    </label>
                    {/* Saved payment methods */}
                    {savedMethods.map((m) => (
                      <label
                        key={m.id}
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          selectedMethod === m.id
                            ? "border-primary-500 bg-primary-50 dark:bg-primary-900/20"
                            : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                        }`}
                      >
                        <input
                          type="radio"
                          name="paymentMethod"
                          value={m.id}
                          checked={selectedMethod === m.id}
                          onChange={() => setSelectedMethod(m.id)}
                          className="accent-primary-600"
                        />
                        <CreditCard className="h-5 w-5 text-blue-600 flex-shrink-0" />
                        <div className="flex-1">
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                            {m.card_brand || m.payment_type}{" "}
                            {m.last_four ? `•••• ${m.last_four}` : ""}
                          </span>
                          {m.is_default && (
                            <span className="ml-2 text-xs bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full">
                              Default
                            </span>
                          )}
                          {m.expiry_month && m.expiry_year && (
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              Expires {m.expiry_month.toString().padStart(2, "0")}/{m.expiry_year}
                            </p>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
                {/* Price breakdown */}
                <div className="mb-6 space-y-2 text-sm text-gray-700 dark:text-gray-300">
                  <div className="flex items-center justify-between">
                    <span>Service Amount</span>
                    <span>{formatCurrency(subtotal)}</span>
                  </div>
                  <div className="flex items-center justify-between text-gray-500 dark:text-gray-400">
                    <span>GST ({siteConfig.gstRate}% on service fee)</span>
                    <span>{formatCurrency(gstAmt)}</span>
                  </div>
                  <div className="flex items-center justify-between font-bold text-base border-t border-gray-200 dark:border-gray-700 pt-2">
                    <span className="text-gray-900 dark:text-white">Total due</span>
                    <span className="text-primary-600 dark:text-primary-400">
                      {formatCurrency(totalDue)}
                    </span>
                  </div>
                </div>
                {showConfirm ? (
                  <div className="border border-yellow-300 dark:border-yellow-700 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4 space-y-3">
                    <p className="text-sm font-medium text-yellow-900 dark:text-yellow-200">
                      Confirm payment of{" "}
                      <strong>
                        {formatCurrency(totalDue)}
                      </strong>
                      ? This action cannot be reversed.
                    </p>
                    <div className="flex gap-3">
                      <Button
                        onClick={() => payMutation.mutate()}
                        isLoading={payMutation.isPending}
                        className="flex-1"
                        size="lg"
                      >
                        {payMutation.isPending
                          ? "Processing…"
                          : "Confirm Payment"}
                      </Button>
                      <Button
                        variant="outline"
                        size="lg"
                        onClick={() => setShowConfirm(false)}
                        disabled={payMutation.isPending}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    onClick={() => setShowConfirm(true)}
                    disabled={amount === 0}
                    className="w-full"
                    size="lg"
                  >
                    {`Pay ${formatCurrency(totalDue)}`}
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
}

// â”€â”€â”€ Subscription Checkout Flow â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function SubscriptionCheckout({ planId }: { planId: string | null }) {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { can } = usePermissions();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push(
        ROUTES.LOGIN +
          "?callbackUrl=/checkout" +
          (planId ? `?plan=${planId}` : ""),
      );
    }
  }, [isAuthenticated, authLoading, router, planId]);

  const { data: provider, isLoading: providerLoading } = useQuery({
    queryKey: ["my-provider-profile", user?.id],
    queryFn: () => getProviderProfileByUserId(user!.id),
    enabled:
      isAuthenticated && can(Permission.SUBSCRIPTIONS_MANAGE) && !!user?.id,
  });

  const { data: plans, isLoading: plansLoading } = useQuery({
    queryKey: ["pricing-plans"],
    queryFn: () => paymentService.getActivePricingPlans(),
    enabled: isAuthenticated,
  });

  const selectedPlan: PricingPlan | undefined =
    plans?.find((p) => p.id === planId) ?? plans?.[0];

  const subscribeMutation = useMutation({
    mutationFn: async () => {
      if (!selectedPlan) throw new Error("Plan not found");
      if (!provider?.id) throw new Error("Provider profile not found");
      const subscription = await paymentService.createSubscription({
        provider_id: provider.id,
        plan_id: selectedPlan.id,
      });
      const subscriptionId =
        (subscription as any)?.data?.id ?? (subscription as any)?.id;
      if (!subscriptionId)
        throw new Error("Subscription created but ID not returned");
      await paymentService.activateSubscription(subscriptionId);
      return subscription;
    },
    onSuccess: () => {
      toast.success("Subscription activated successfully!");
      router.push(`${ROUTES.DASHBOARD_SETTINGS}/subscription`);
    },
    onError: (error: any) => {
      const message =
        error?.response?.data?.error?.message ||
        error?.response?.data?.message ||
        error?.message ||
        "Failed to activate subscription.";
      toast.error(message);
    },
  });

  if (authLoading || plansLoading || providerLoading) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <Loading />
        </div>
      </Layout>
    );
  }

  if (!isAuthenticated) return null;

  if (!selectedPlan) {
    return (
      <Layout>
        <div className="container-custom py-12 text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Plan not found
          </h2>
          <Link href="/pricing">
            <Button variant="outline">
              <ArrowLeft className="w-4 h-4 mr-2" />
              View Pricing Plans
            </Button>
          </Link>
        </div>
      </Layout>
    );
  }

  const features: string[] = selectedPlan.features
    ? Object.entries(selectedPlan.features)
        .filter(([, v]) => Boolean(v))
        .map(([k]) =>
          k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        )
    : [];

  const missingProviderProfile = !provider?.id;

  return (
    <Layout>
      <div className="bg-gray-50 dark:bg-gray-900 min-h-screen py-12">
        <div className="max-w-2xl mx-auto px-4">
          <div className="mb-6">
            <Link
              href="/pricing"
              className="inline-flex items-center text-sm text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back to Pricing
            </Link>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">
            Checkout
          </h1>
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Order Summary
                </h2>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white text-lg">
                      {selectedPlan.name}
                    </p>
                    {selectedPlan.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {selectedPlan.description}
                      </p>
                    )}
                    <p className="text-sm text-gray-500 dark:text-gray-500 capitalize mt-1">
                      Billed {selectedPlan.billing_period}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-primary-600 dark:text-primary-400">
                      {formatCurrency(selectedPlan.price)}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-500">
                      /{selectedPlan.billing_period === "yearly" ? "yr" : "mo"}
                    </p>
                  </div>
                </div>
                {features.length > 0 && (
                  <ul className="space-y-2 border-t border-gray-200 dark:border-gray-700 pt-4">
                    {features.map((feat) => (
                      <li
                        key={feat}
                        className="flex items-center text-sm text-gray-700 dark:text-gray-300"
                      >
                        <CheckCircle className="w-4 h-4 text-green-500 mr-2 flex-shrink-0" />
                        {feat}
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                  <CreditCard className="w-5 h-5 mr-2" />
                  Activate Plan
                </h2>
              </CardHeader>
              <CardContent>
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4 mb-6 text-sm text-blue-900 dark:text-blue-200">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                    <div>
                      <p className="font-medium mb-1">
                        Instant activation in test/development mode.
                      </p>
                      <p>
                        Your subscription will be active immediately. Manage
                        upgrades and cancellation from subscription settings.
                      </p>
                      {missingProviderProfile && (
                        <p className="mt-2">
                          A provider profile is required before you can activate
                          a subscription plan.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between mb-4 text-gray-700 dark:text-gray-300">
                  <span>Total due today</span>
                  <span className="font-bold text-lg">
                    {formatCurrency(selectedPlan.price)}
                  </span>
                </div>
                <Button
                  onClick={() => subscribeMutation.mutate()}
                  isLoading={subscribeMutation.isPending}
                  disabled={missingProviderProfile}
                  className="w-full"
                  size="lg"
                >
                  {subscribeMutation.isPending
                    ? "Activating Subscriptionâ€¦"
                    : `Subscribe Now â€” ${formatCurrency(selectedPlan.price)}`}
                </Button>
                <p className="text-xs text-center text-gray-500 dark:text-gray-400 mt-3">
                  Manage your current plan and subscription history from{" "}
                  <Link
                    href={ROUTES.DASHBOARD_SETTINGS + "/subscription"}
                    className="underline font-medium"
                  >
                    subscription settings
                  </Link>
                  .
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
}

// â”€â”€â”€ Router â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function CheckoutContent() {
  const searchParams = useSearchParams();
  const jobId = searchParams.get("jobId");
  const planId = searchParams.get("plan");

  if (jobId) return <JobCheckout jobId={jobId} />;
  return <SubscriptionCheckout planId={planId} />;
}

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <Layout>
          <div className="min-h-screen flex items-center justify-center">
            <Loading />
          </div>
        </Layout>
      }
    >
      <CheckoutContent />
    </Suspense>
  );
}
