"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { Mail, RefreshCw, Loader2, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { authService } from "@/services/auth-service";
import toast from "react-hot-toast";

export default function VerifyEmailRequiredPage() {
  const router = useRouter();
  const { data: session, update } = useSession();
  const [sending, setSending] = useState(false);
  const [checking, setChecking] = useState(false);
  const [sent, setSent] = useState(false);

  // Auto-redirect if the user verifies in another tab
  useEffect(() => {
    if (session?.user?.emailVerified || session?.user?.phoneVerified) {
      router.replace("/dashboard");
    }
  }, [session, router]);

  const handleResend = async () => {
    const email = session?.user?.email;
    if (!email || sending) return;
    setSending(true);
    setSent(false);
    try {
      await authService.resendVerificationEmail(email);
      setSent(true);
      toast.success("Verification email sent — check your inbox");
    } catch (err: any) {
      const msg =
        err?.response?.data?.error?.message ||
        err?.response?.data?.message ||
        "Failed to send verification email. Please try again.";
      toast.error(msg);
    } finally {
      setSending(false);
    }
  };

  const handleCheckVerified = async () => {
    if (checking) return;
    setChecking(true);
    try {
      const updated = await update({ force: true });
      if (updated?.user?.emailVerified || updated?.user?.phoneVerified) {
        router.replace("/dashboard");
      } else {
        toast.error(
          "Your email isn't verified yet — check your inbox for the link.",
        );
      }
    } finally {
      setChecking(false);
    }
  };

  const email = session?.user?.email;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 text-center">
        <div className="mx-auto h-16 w-16 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center mb-6">
          <Mail className="h-8 w-8 text-primary-600 dark:text-primary-400" />
        </div>

        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Verify your email
        </h1>

        <p className="text-gray-600 dark:text-gray-400 mb-1">
          We sent a verification link to
        </p>
        {email && (
          <p className="font-semibold text-gray-900 dark:text-white mb-6 break-all">
            {email}
          </p>
        )}

        <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">
          Click the link in the email to activate your account. Can&apos;t find
          it? Check your spam folder or request a new link below.
        </p>

        {sent && (
          <div className="flex items-center gap-2 justify-center text-green-600 dark:text-green-400 mb-5 text-sm font-medium">
            <CheckCircle className="h-4 w-4 flex-shrink-0" />
            <span>Verification email sent!</span>
          </div>
        )}

        <div className="space-y-3">
          <Button
            onClick={handleCheckVerified}
            disabled={checking}
            className="w-full"
          >
            {checking ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Checking…
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                I&apos;ve verified my email
              </>
            )}
          </Button>

          <Button
            variant="outline"
            onClick={handleResend}
            disabled={sending}
            className="w-full"
          >
            {sending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending…
              </>
            ) : (
              "Resend verification email"
            )}
          </Button>

          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="w-full text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 py-2 transition-colors"
          >
            Sign out and use a different account
          </button>
        </div>
      </div>
    </div>
  );
}
