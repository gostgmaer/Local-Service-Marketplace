"use client";

import { Suspense, useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { authService } from "@/services/auth-service";
import { ROUTES } from "@/config/constants";
import { Button } from "@/components/ui/Button";
import { Shield } from "lucide-react";
import toast from "react-hot-toast";

export default function TwoFAChallengePageWrapper() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
        </div>
      }
    >
      <TwoFAChallengePage />
    </Suspense>
  );
}

function TwoFAChallengePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [code, setCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const token = sessionStorage.getItem("mfaToken");
    if (!token) {
      // No MFA token — redirect back to login
      router.replace(ROUTES.LOGIN);
      return;
    }
    setMfaToken(token);
    inputRef.current?.focus();
  }, [router]);

  const handleVerify = async () => {
    if (!mfaToken || code.length < 6) return;
    setIsLoading(true);
    try {
      // Exchange MFA token + TOTP code for full tokens
      const { accessToken, refreshToken } = await authService.completeMfaLogin(
        mfaToken,
        code,
      );

      // Clear the stored MFA token
      sessionStorage.removeItem("mfaToken");

      // Use the "oauth-token" NextAuth provider to create a proper session
      const result = await signIn("oauth-token", {
        token: accessToken,
        refreshToken,
        redirect: false,
      });

      if (result?.error || !result?.ok) {
        throw new Error("Failed to establish session after MFA");
      }

      toast.success("Welcome back!");
      const callbackUrl = searchParams.get("callbackUrl");
      router.push(callbackUrl || ROUTES.DASHBOARD);
    } catch (error: any) {
      const msg =
        error?.response?.data?.message ||
        error?.message ||
        "Invalid 2FA code. Please try again.";
      toast.error(msg);
      setCode("");
      inputRef.current?.focus();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4">
      <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-lg p-8 space-y-6">
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center justify-center w-14 h-14 rounded-full bg-primary-100 dark:bg-primary-900/30 mb-1">
            <Shield className="w-7 h-7 text-primary-600 dark:text-primary-400" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Two-Factor Authentication
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
            Enter the 6-digit code from your authenticator app, or one of your
            backup codes.
          </p>
        </div>

        <div className="space-y-4">
          <div className="flex justify-center">
            <input
              ref={inputRef}
              type="text"
              inputMode="numeric"
              maxLength={8}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\s/g, ""))}
              onKeyDown={(e) => e.key === "Enter" && handleVerify()}
              placeholder="000000"
              className="w-48 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl text-center font-mono text-2xl tracking-[0.4em] bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              autoComplete="one-time-code"
            />
          </div>

          <Button
            className="w-full"
            disabled={code.length < 6 || isLoading || !mfaToken}
            onClick={handleVerify}
          >
            {isLoading ? "Verifying..." : "Verify"}
          </Button>

          <button
            type="button"
            className="w-full text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 underline"
            onClick={() => {
              sessionStorage.removeItem("mfaToken");
              router.push(ROUTES.LOGIN);
            }}
          >
            Back to login
          </button>
        </div>
      </div>
    </div>
  );
}
