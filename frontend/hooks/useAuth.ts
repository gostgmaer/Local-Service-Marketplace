"use client";

import { useSession, signIn, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ROUTES, getDashboardHomeByRole, API_URL } from "@/config/constants";
import { authService, SignupData } from "@/services/auth-service";
import toast from "react-hot-toast";

export function useAuth() {
  const router = useRouter();
  const { data: session, status, update } = useSession();

  const isLoading = status === "loading";
  const isAuthenticated = status === "authenticated";
  const user = session?.user;
  const permissions = user?.permissions ?? [];

  // Handle token refresh errors
  useEffect(() => {
    if (session?.error === "RefreshAccessTokenError") {
      // Token refresh failed - force logout
      toast.error("Session expired. Please log in again.");
      signOut({ redirect: false }).then(() => {
        router.push(ROUTES.LOGIN);
      });
    }
  }, [session?.error, router]);

  // When a page is restored from bfcache (browser back/forward navigation),
  // React context retains the previous session state. Force a re-validation so
  // pages using inline useEffect auth checks also respond to a stale session.
  useEffect(() => {
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        update();
      }
    };
    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, [update]);

  const login = async (email: string, password: string) => {
    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        throw new Error(
          result.error === "CredentialsSignin"
            ? "Invalid email or password."
            : result.error,
        );
      }

      if (!result?.ok) {
        throw new Error("Login failed. Please check your credentials.");
      }

      return result;
    } catch (error) {
      if (error instanceof Error) throw error;
      throw new Error("Login failed. Please try again.");
    }
  };

  const loginWithPhone = async (phone: string, password: string) => {
    try {
      const result = await signIn("phone-password", {
        phone,
        password,
        redirect: false,
      });

      if (result?.error) {
        throw new Error(
          result.error === "CredentialsSignin"
            ? "Invalid phone or password."
            : result.error,
        );
      }

      if (!result?.ok) {
        throw new Error("Phone login failed. Please check your credentials.");
      }

      return result;
    } catch (error) {
      if (error instanceof Error) throw error;
      throw new Error("Phone login failed. Please try again.");
    }
  };

  const loginWithOTP = async (phone: string, otp: string) => {
    try {
      const result = await signIn("phone-otp", {
        phone,
        otp,
        redirect: false,
      });

      if (result?.error) {
        throw new Error(
          result.error === "CredentialsSignin"
            ? "Invalid OTP code."
            : result.error,
        );
      }

      if (!result?.ok) {
        throw new Error("OTP verification failed. Please check your code.");
      }

      return result;
    } catch (error) {
      if (error instanceof Error) throw error;
      throw new Error("OTP verification failed. Please try again.");
    }
  };

  const requestOTP = async (phone: string) => {
    const response = await fetch(
      `${API_URL}/api/v1/user/auth/phone/otp/request`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ phone }),
      },
    );

    if (!response.ok) {
      throw new Error("Failed to send OTP. Please try again.");
    }

    const data = await response.json();
    return data;
  };

  const requestEmailOTP = async (email: string) => {
    const response = await fetch(
      `${API_URL}/api/v1/user/auth/email/otp/request`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      },
    );

    if (!response.ok) {
      throw new Error("Failed to send OTP. Please try again.");
    }

    const data = await response.json();
    return data;
  };

  const loginWithEmailOTP = async (email: string, otp: string) => {
    try {
      const result = await signIn("email-otp", {
        email,
        otp,
        redirect: false,
      });

      if (result?.error) {
        throw new Error(
          result.error === "CredentialsSignin"
            ? "Invalid OTP code."
            : result.error,
        );
      }

      if (!result?.ok) {
        throw new Error("OTP verification failed. Please check your code.");
      }

      return result;
    } catch (error) {
      if (error instanceof Error) throw error;
      throw new Error("Email OTP verification failed. Please try again.");
    }
  };

  const loginWithGoogle = () => {
    // Redirect to backend OAuth endpoint
    window.location.href = `${API_URL}/api/v1/user/auth/google`;
  };

  const loginWithFacebook = () => {
    // Redirect to backend OAuth endpoint
    window.location.href = `${API_URL}/api/v1/user/auth/facebook`;
  };

  const signup = async (data: SignupData) => {
    // Call backend signup endpoint
    const response = await authService.signup(data);

    // After successful signup, automatically sign in
    const signInResult = await signIn("credentials", {
      email: data.email,
      password: data.password,
      redirect: false,
    });

    if (!signInResult?.ok) {
      throw new Error(
        "Account created but auto-login failed. Please log in manually.",
      );
    }

    // Let component handle success and redirect
    return response;
  };

  const logout = async () => {
    // Backend session revocation is handled automatically by the
    // events.signOut callback in authOptions (auth.config.ts).
    await signOut({ redirect: false });
    toast.success("Logged out successfully");
    // Hard redirect: clears all in-memory React/query state and ensures
    // no stale session data persists in the current JS context.
    window.location.href = ROUTES.LOGIN;
  };

  const requireAuth = () => {
    if (!isAuthenticated && !isLoading) {
      router.push(ROUTES.LOGIN);
    }
  };

  const requireRole = (roles: string[]) => {
    if (!isAuthenticated || !user) {
      router.push(ROUTES.LOGIN);
      return false;
    }
    if (!roles.includes(user.role)) {
      router.push(getDashboardHomeByRole(user.role));
      return false;
    }
    return true;
  };

  const providerVerificationStatus =
    (user as { providerVerificationStatus?: string | null })
      ?.providerVerificationStatus ?? null;

  return {
    // Session state
    user,
    session,
    isLoading,
    isAuthenticated,
    permissions,
    providerVerificationStatus,

    // Email/Password auth
    login,
    signup,
    logout,

    // Phone auth
    loginWithPhone,
    loginWithOTP,
    requestOTP,

    // Email OTP auth
    loginWithEmailOTP,
    requestEmailOTP,

    // OAuth
    loginWithGoogle,
    loginWithFacebook,

    // Utilities
    requireAuth,
    requireRole,
    updateSession: update,

    // Debugging
    tokenExpires: session?.accessTokenExpires,
    hasTokenError: session?.error === "RefreshAccessTokenError",
  };
}
