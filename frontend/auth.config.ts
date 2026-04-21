// NextAuthOptions not imported directly to avoid @auth/core v5 type conflict.
// TypeScript infers the correct v4 type from NextAuth(authOptions) at call site.
import CredentialsProvider from "next-auth/providers/credentials";
import { TOKEN_CONFIG } from "@/types/auth-alignment";
import { serverAuthService } from "@/services/server-auth-service";
import { isMfaRequiredResponse } from "@/types/auth-alignment";

function decodeJwtPayload(token: string): any {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return {};
    const payload = Buffer.from(parts[1], "base64url").toString("utf8");
    return JSON.parse(payload);
  } catch {
    return {};
  }
}

/** Returns the ms timestamp at which we should proactively refresh — 5 minutes before actual expiry.
 *  Falls back to TOKEN_CONFIG if the JWT has no `exp` claim. */
const EARLY_REFRESH_MS = 5 * 60 * 1000; // 5 minutes
function getTokenExpiry(accessToken: string): number {
  const payload = decodeJwtPayload(accessToken);
  if (payload?.exp && typeof payload.exp === "number") {
    // payload.exp is seconds since epoch → convert to ms, then subtract buffer
    return payload.exp * 1000 - EARLY_REFRESH_MS;
  }
  // Fallback: use configured expiration minus buffer
  return Date.now() + TOKEN_CONFIG.ACCESS_TOKEN_EXPIRATION - EARLY_REFRESH_MS;
}

async function refreshAccessToken(token: any, attempt = 1): Promise<any> {
  try {
    if (!token?.refreshToken) {
      console.error("No refresh token available");
      return { ...token, error: "RefreshAccessTokenError" as const };
    }
    const data = await serverAuthService.refreshToken(token.refreshToken);
    if (!data) throw new Error("Token refresh failed");

    // Extract updated permissions and verification status from the new access token
    let permissions = token.permissions || [];
    let emailVerified = token.emailVerified as boolean | undefined;
    let phoneVerified = token.phoneVerified as boolean | undefined;
    let providerVerificationStatus = token.providerVerificationStatus as string | null | undefined;
    if (data.accessToken) {
      const jwtPayload = decodeJwtPayload(data.accessToken);
      if (Array.isArray(jwtPayload.permissions)) {
        permissions = jwtPayload.permissions;
      }
      if (typeof jwtPayload.email_verified === "boolean") {
        emailVerified = jwtPayload.email_verified;
      }
      if (typeof jwtPayload.phone_verified === "boolean") {
        phoneVerified = jwtPayload.phone_verified;
      }
      if (typeof jwtPayload.provider_verification_status === "string") {
        providerVerificationStatus = jwtPayload.provider_verification_status;
      }
    }

    return {
      ...token,
      accessToken: data.accessToken,
      accessTokenExpires: getTokenExpiry(data.accessToken),
      refreshToken: data.refreshToken ?? token.refreshToken,
      permissions,
      emailVerified,
      phoneVerified,
      providerVerificationStatus,
    };
  } catch (error) {
    console.error(`Error refreshing access token (attempt ${attempt}):`, error);
    // Retry up to 2 times for transient failures (service restarts, brief network blips)
    // before giving up and forcing re-login. Add a small back-off delay.
    if (attempt < 3) {
      await new Promise((resolve) => setTimeout(resolve, attempt * 1500));
      return refreshAccessToken(token, attempt + 1);
    }
    return { ...token, error: "RefreshAccessTokenError" as const };
  }
}

export const authOptions = {
  providers: [
    // Email + Password Login
    CredentialsProvider({
      id: "credentials",
      name: "Email & Password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        try {
          if (!credentials?.email || !credentials?.password) return null;

          const auth = await serverAuthService.loginWithEmail(
            credentials.email as string,
            credentials.password as string,
          );
          if (!auth) return null;

          // 2FA required — signal to the client to complete the MFA challenge
          if (isMfaRequiredResponse(auth)) {
            throw new Error(`REQUIRES_MFA:${auth.mfaToken}`);
          }

          if (!auth.user) return null;

          return {
            id: auth.user.id,
            email: auth.user.email,
            name: auth.user.name || auth.user.email.split("@")[0],
            role: auth.user.role,
            emailVerified: auth.user.email_verified,
            image: auth.user.profile_picture_url || null,
            accessToken: auth.accessToken,
            refreshToken: auth.refreshToken,
          };
        } catch (error) {
          // Re-throw MFA signals as-is so they reach the client
          if (
            error instanceof Error &&
            error.message.startsWith("REQUIRES_MFA:")
          ) {
            throw error;
          }
          console.error("Authentication error:", error);
          return null;
        }
      },
    }),

    // Phone + Password Login
    CredentialsProvider({
      id: "phone-password",
      name: "Phone & Password",
      credentials: {
        phone: { label: "Phone", type: "tel" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        try {
          if (!credentials?.phone || !credentials?.password) return null;

          const auth = await serverAuthService.loginWithPhone(
            credentials.phone as string,
            credentials.password as string,
          );
          if (!auth?.user) return null;

          return {
            id: auth.user.id,
            email: auth.user.email,
            name: auth.user.name || "User",
            role: auth.user.role,
            emailVerified: auth.user.email_verified,
            image: auth.user.profile_picture_url || null,
            accessToken: auth.accessToken,
            refreshToken: auth.refreshToken,
          };
        } catch (error) {
          console.error("Phone authentication error:", error);
          return null;
        }
      },
    }),

    // Phone + OTP Login
    CredentialsProvider({
      id: "phone-otp",
      name: "Phone & OTP",
      credentials: {
        phone: { label: "Phone", type: "tel" },
        otp: { label: "OTP", type: "text" },
      },
      async authorize(credentials) {
        try {
          if (!credentials?.phone || !credentials?.otp) return null;

          const auth = await serverAuthService.verifyPhoneOtp(
            credentials.phone as string,
            credentials.otp as string,
          );
          if (!auth?.user) return null;

          return {
            id: auth.user.id,
            email: auth.user.email,
            name: auth.user.name || "User",
            role: auth.user.role,
            emailVerified: auth.user.email_verified,
            image: auth.user.profile_picture_url || null,
            accessToken: auth.accessToken,
            refreshToken: auth.refreshToken,
          };
        } catch (error) {
          console.error("OTP authentication error:", error);
          return null;
        }
      },
    }),

    // Email + OTP Login
    CredentialsProvider({
      id: "email-otp",
      name: "Email & OTP",
      credentials: {
        email: { label: "Email", type: "email" },
        otp: { label: "OTP", type: "text" },
      },
      async authorize(credentials) {
        try {
          if (!credentials?.email || !credentials?.otp) return null;

          const auth = await serverAuthService.verifyEmailOtp(
            credentials.email as string,
            credentials.otp as string,
          );
          if (!auth?.user) return null;

          return {
            id: auth.user.id,
            email: auth.user.email,
            name: auth.user.name || auth.user.email.split("@")[0],
            role: auth.user.role,
            emailVerified: auth.user.email_verified,
            image: auth.user.profile_picture_url || null,
            accessToken: auth.accessToken,
            refreshToken: auth.refreshToken,
          };
        } catch (error) {
          console.error("Email OTP authentication error:", error);
          return null;
        }
      },
    }),

    // OAuth Token — used by /auth/callback after one-time code exchange
    // to establish NextAuth session from backend-issued tokens
    CredentialsProvider({
      id: "oauth-token",
      name: "OAuth Token",
      credentials: {
        token: { label: "Access Token", type: "text" },
        refreshToken: { label: "Refresh Token", type: "text" },
      },
      async authorize(credentials) {
        try {
          if (!credentials?.token) return null;

          const user = await serverAuthService.getProfileFromToken(
            credentials.token as string,
          );
          if (!user) return null;

          return {
            id: user.id,
            email: user.email,
            name: user.name || user.email.split("@")[0],
            role: user.role,
            emailVerified: user.email_verified,
            image: user.profile_picture_url || null,
            accessToken: credentials.token as string,
            refreshToken: (credentials.refreshToken as string) || "",
          };
        } catch (error) {
          console.error("OAuth token authentication error:", error);
          return null;
        }
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge:
      parseInt(process.env.SESSION_MAX_AGE_DAYS ?? "90", 10) * 24 * 60 * 60, // SESSION_MAX_AGE_DAYS env (default 90 days)
  },
  callbacks: {
    async jwt({ token, user, trigger, session }: any) {
      // Initial sign in — fetch full profile from /me to populate all user fields
      if (user) {
        // Enrich with complete profile data from /user/auth/me
        let profile: Awaited<
          ReturnType<typeof serverAuthService.getProfileFromToken>
        > = null;
        try {
          profile = await serverAuthService.getProfileFromToken(
            user.accessToken,
          );
        } catch {
          // If /me fails, fall back to login response data
        }

        // Extract permissions from the JWT access token payload
        let permissions: string[] = [];
        if (user.accessToken) {
          const jwtPayload = decodeJwtPayload(user.accessToken);
          if (Array.isArray(jwtPayload.permissions)) {
            permissions = jwtPayload.permissions;
          }
        }

        return {
          ...token,
          id: profile?.id ?? user.id,
          email: profile?.email ?? user.email,
          name: profile?.name ?? user.name,
          image: profile?.profile_picture_url ?? user.image ?? null,
          role: profile?.role ?? user.role,
          permissions,
          emailVerified:
            profile !== null
              ? Boolean(profile.email_verified)
              : typeof user.emailVerified === "boolean"
                ? user.emailVerified
                : false,
          phoneVerified:
            profile !== null ? Boolean(profile.phone_verified) : false,
          providerVerificationStatus:
            profile?.provider_verification_status ?? null,
          timezone: profile?.timezone ?? null,
          language: profile?.language ?? null,
          accessToken: user.accessToken,
          refreshToken: user.refreshToken,
          accessTokenExpires: getTokenExpiry(user.accessToken),
        };
      }

      // Handle session updates (e.g., from client-side session.update())
      if (trigger === "update" && session) {
        // Re-fetch profile to pick up verification status changes (e.g. email just verified)
        let freshVerifiedFlags: {
          emailVerified?: boolean;
          phoneVerified?: boolean;
          providerVerificationStatus?: string | null;
        } = {};
        try {
          if (token?.accessToken) {
            const profile = await serverAuthService.getProfileFromToken(
              token.accessToken as string,
            );
            if (profile) {
              freshVerifiedFlags = {
                emailVerified: Boolean(profile.email_verified),
                phoneVerified: Boolean(profile.phone_verified),
                providerVerificationStatus:
                  profile.provider_verification_status ?? null,
              };
            }
          }
        } catch {
          // ignore — fall back to current token values
        }
        return {
          ...token,
          name: session?.user?.name ?? token.name,
          image: session?.user?.image ?? token.image,
          ...freshVerifiedFlags,
        };
      }

      // Return previous token if the access token has not expired yet
      if (token.accessTokenExpires && Date.now() < token.accessTokenExpires) {
        return token;
      }

      // Access token has expired, try to refresh it
      return refreshAccessToken(token);
    },
    async session({ session, token }: any) {
      // Add custom fields to session
      if (token && session.user) {
        session.user.id = token.id || "";
        session.user.email = token.email || session.user.email;
        session.user.name = token.name || session.user.name;
        session.user.image = token.image || session.user.image;
        session.user.role = token.role || "customer";
        session.user.permissions = Array.isArray(token.permissions)
          ? token.permissions
          : [];
        session.user.emailVerified = Boolean(token.emailVerified);
        session.user.phoneVerified = Boolean(token.phoneVerified);
        session.user.providerVerificationStatus =
          token.providerVerificationStatus ?? null;
        session.user.timezone = token.timezone ?? null;
        session.user.language = token.language ?? null;
        session.accessToken = token.accessToken;
        session.accessTokenExpires = token.accessTokenExpires;
        session.error = token.error;
      }
      return session;
    },
  },
  events: {
    /**
     * Called server-side for every signOut() invocation — manual logout,
     * RefreshAccessTokenError handler, session expiry, etc.
     * Revokes the backend refresh token so the session is truly invalidated.
     */
    async signOut({ token }: { token?: any }) {
      const refreshToken = token?.refreshToken as string | undefined;
      await serverAuthService.logout(refreshToken);
    },
  },
  pages: { signIn: "/login", error: "/error" },
  secret: process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET,
};
