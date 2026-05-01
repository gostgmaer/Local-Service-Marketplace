"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import toast from "react-hot-toast";
import { ROUTES } from "@/config/constants";
import { authService } from "@/services/auth-service";

type Status = "loading" | "role-selection" | "success" | "error";

interface RoleOption {
  value: "customer" | "provider";
  label: string;
  description: string;
}

const ROLE_OPTIONS: RoleOption[] = [
  {
    value: "customer",
    label: "I need a service",
    description: "Browse and hire skilled local service providers",
  },
  {
    value: "provider",
    label: "I provide services",
    description: "Offer your skills and earn by completing service jobs",
  },
];

function CallbackSkeleton() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <div className="bg-white rounded-2xl shadow-xl p-10 w-full max-w-sm text-center">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 rounded-full bg-blue-100 animate-pulse" />
        </div>
        <div className="h-5 bg-gray-200 rounded animate-pulse mb-3 mx-auto w-48" />
        <div className="h-4 bg-gray-100 rounded animate-pulse mx-auto w-36" />
      </div>
    </div>
  );
}

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<Status>("loading");
  const [errorMessage, setErrorMessage] = useState<string>(
    "Something went wrong. Please try again.",
  );
  const [countdown, setCountdown] = useState(3);
  const [selectedRole, setSelectedRole] = useState<"customer" | "provider" | null>(null);
  const [email, setEmail] = useState("");
  const [isSubmittingRole, setIsSubmittingRole] = useState(false);
  const exchangeAttempted = useRef(false);
  const pendingTokensRef = useRef<{ accessToken: string; refreshToken: string } | null>(null);
  const needsEmailRef = useRef(false);

  useEffect(() => {
    const handleCallback = async () => {
      // Guard against React StrictMode double-invoke and searchParams re-renders
      if (exchangeAttempted.current) return;
      exchangeAttempted.current = true;

      try {
        const code = searchParams.get("code");
        const oauthError = searchParams.get("error");

        // Remove sensitive query params from the URL before session establishment.
        if (typeof window !== "undefined" && window.location.search) {
          window.history.replaceState(
            {},
            document.title,
            window.location.pathname,
          );
        }

        if (oauthError) {
          setErrorMessage("Authentication was cancelled or denied.");
          setStatus("error");
          return;
        }

        if (!code) {
          setErrorMessage("No OAuth exchange code was received.");
          setStatus("error");
          return;
        }

        const exchange = await authService.exchangeOAuthCode(code);

        // New user: show role selection before creating session
        if (exchange.isNewUser) {
          pendingTokensRef.current = {
            accessToken: exchange.accessToken,
            refreshToken: exchange.refreshToken,
          };
          needsEmailRef.current = exchange.needsEmail ?? false;
          setStatus("role-selection");
          return;
        }

        // Existing user: complete sign in immediately
        await completeSignIn(exchange.accessToken, exchange.refreshToken);
      } catch (err: any) {
        console.error("OAuth callback error:", err);
        setErrorMessage(
          err.message || "Authentication failed. Please try again.",
        );
        setStatus("error");
      }
    };

    handleCallback();
  }, [searchParams, router]);

  const completeSignIn = async (
    accessToken: string,
    refreshToken: string,
    redirectTo: string = ROUTES.DASHBOARD,
  ) => {
    const result = await signIn("oauth-token", {
      token: accessToken,
      refreshToken,
      redirect: false,
    });

    if (result?.error) {
      setErrorMessage("We couldn't create your session. Please try again.");
      setStatus("error");
      return;
    }

    setStatus("success");
    toast.success("Welcome! You're now signed in.");
    setTimeout(() => router.push(redirectTo), 1200);
  };

  const handleRoleSubmit = async () => {
    if (!selectedRole) {
      toast.error("Please select whether you need a service or provide services.");
      return;
    }
    if (needsEmailRef.current && !email.trim()) {
      toast.error("Please enter your email address to continue.");
      return;
    }
    if (needsEmailRef.current && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Please enter a valid email address.");
      return;
    }

    const tokens = pendingTokensRef.current;
    if (!tokens) {
      setErrorMessage("Session expired. Please try signing in again.");
      setStatus("error");
      return;
    }

    setIsSubmittingRole(true);
    try {
      const updated = await authService.setOAuthRole(
        selectedRole,
        tokens.accessToken,
        needsEmailRef.current ? email : undefined,
      );
      toast.success(
        selectedRole === "provider"
          ? "Account created as Service Provider! Let's set up your profile."
          : "Account created! Welcome aboard.",
      );
      await completeSignIn(
        updated.accessToken,
        updated.refreshToken,
        selectedRole === "provider" ? ROUTES.ONBOARDING : ROUTES.DASHBOARD,
      );
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to save your selection. Please try again.");
    } finally {
      setIsSubmittingRole(false);
    }
  };

  useEffect(() => {
    if (status !== "error") return;
    if (countdown <= 0) {
      router.push(ROUTES.LOGIN);
      return;
    }
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [status, countdown, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50 px-4">
      <div className="bg-white rounded-2xl shadow-xl p-10 w-full max-w-sm text-center">
        {status === "loading" && (
          <>
            <div className="flex justify-center mb-6">
              <div className="relative w-16 h-16">
                <div className="absolute inset-0 rounded-full border-4 border-blue-100" />
                <div className="absolute inset-0 rounded-full border-4 border-blue-600 border-t-transparent animate-spin" />
              </div>
            </div>
            <h1 className="text-xl font-semibold text-gray-900 mb-2">
              Signing you in...
            </h1>
            <p className="text-sm text-gray-500">
              Please wait while we securely complete your login.
            </p>
          </>
        )}

        {status === "role-selection" && (
          <>
            <div className="flex justify-center mb-4">
              <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center">
                <svg className="w-7 h-7 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
            </div>
            <h1 className="text-xl font-semibold text-gray-900 mb-1">
              Welcome! How will you use this platform?
            </h1>
            <p className="text-sm text-gray-500 mb-6">
              Choose your account type to get started.
              <span className="text-red-500 ml-0.5">*</span>
            </p>

            <div className="space-y-3 mb-5 text-left">
              {ROLE_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    selectedRole === option.value
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:border-blue-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="role"
                    value={option.value}
                    checked={selectedRole === option.value}
                    onChange={() => setSelectedRole(option.value)}
                    className="mt-1 accent-blue-600"
                  />
                  <div>
                    <p className="font-medium text-gray-900 text-sm">{option.label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{option.description}</p>
                  </div>
                </label>
              ))}
            </div>

            {needsEmailRef.current && (
              <div className="mb-5 text-left">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email address <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                />
                <p className="mt-1 text-xs text-gray-400">
                  Required since your sign-in provider did not share an email.
                </p>
              </div>
            )}

            <button
              onClick={handleRoleSubmit}
              disabled={isSubmittingRole || !selectedRole}
              className="w-full py-2.5 rounded-xl bg-blue-600 text-white font-medium text-sm hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmittingRole ? "Saving..." : "Continue"}
            </button>
          </>
        )}

        {status === "success" && (
          <>
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-green-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
            </div>
            <h1 className="text-xl font-semibold text-gray-900 mb-2">
              You're in!
            </h1>
            <p className="text-sm text-gray-500">
              Redirecting you to your dashboard...
            </p>
            <div className="mt-5 h-1 w-full bg-gray-100 rounded-full overflow-hidden">
              <div className="h-1 bg-green-500 rounded-full animate-[progress_1.2s_ease-in-out_forwards]" />
            </div>
          </>
        )}

        {status === "error" && (
          <>
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-red-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </div>
            </div>
            <h1 className="text-xl font-semibold text-gray-900 mb-2">
              Authentication Failed
            </h1>
            <p className="text-sm text-gray-500 mb-6">{errorMessage}</p>

            <Link
              href={ROUTES.LOGIN}
              className="inline-flex items-center justify-center w-full gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Back to Login
            </Link>

            <p className="mt-4 text-xs text-gray-400">
              Redirecting automatically in{" "}
              <span className="font-semibold text-gray-600">{countdown}s</span>
              ...
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export default function AuthCallbackFlow() {
  return (
    <Suspense fallback={<CallbackSkeleton />}>
      <AuthCallbackContent />
    </Suspense>
  );
}
