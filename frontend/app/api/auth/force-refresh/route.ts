/**
 * POST /api/auth/force-refresh
 *
 * Forces a backend token refresh regardless of whether NextAuth considers the
 * current access token still valid. This closes the gap where the backend
 * rejects a token (clock skew, server-side invalidation) but the UI still
 * shows the old NextAuth session as "active" because `accessTokenExpires`
 * hasn't been reached yet.
 *
 * Flow:
 *  1. Read the raw NextAuth JWT from the session cookie via getToken()
 *  2. Call the identity-service /auth/refresh endpoint directly
 *  3. Re-encode the refreshed token and overwrite the session cookie
 *  4. Return the new accessToken in the response body for immediate retry use
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken, encode } from "next-auth/jwt";
import { serverAuthService } from "@/services/server-auth-service";

const SESSION_MAX_AGE_SECONDS =
  parseInt(process.env.SESSION_MAX_AGE_DAYS ?? "90", 10) * 24 * 60 * 60;

function decodeJwtPayload(token: string): any {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return {};
    return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  } catch {
    return {};
  }
}

const EARLY_REFRESH_MS = 5 * 60 * 1000;
function getTokenExpiry(accessToken: string): number {
  const payload = decodeJwtPayload(accessToken);
  if (payload?.exp && typeof payload.exp === "number") {
    return payload.exp * 1000 - EARLY_REFRESH_MS;
  }
  // Fallback: 23 hours from now
  return Date.now() + 23 * 60 * 60 * 1000;
}

export async function POST(request: NextRequest) {
  const secret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "Server misconfigured: missing secret" },
      { status: 500 },
    );
  }

  // Determine whether we are on HTTPS (affects the cookie name NextAuth uses)
  const isHttps =
    request.url.startsWith("https://") ||
    (process.env.NEXTAUTH_URL ?? "").startsWith("https://");

  // Read the existing raw JWT from the session cookie
  const token = await getToken({ req: request, secret, secureCookie: isHttps });

  if (!token) {
    return NextResponse.json({ error: "No session" }, { status: 401 });
  }

  if (!token.refreshToken) {
    return NextResponse.json({ error: "No refresh token" }, { status: 401 });
  }

  // Call the backend refresh endpoint directly — no expiry check
  const refreshed = await serverAuthService.refreshToken(
    token.refreshToken as string,
  );

  if (!refreshed?.accessToken) {
    // Refresh token is also expired or revoked — signal the client to sign out
    return NextResponse.json({ error: "RefreshAccessTokenError" }, { status: 401 });
  }

  // Extract updated claims from the new access token payload
  const newPayload = decodeJwtPayload(refreshed.accessToken);

  const newToken: Record<string, unknown> = {
    ...token,
    accessToken: refreshed.accessToken,
    accessTokenExpires: getTokenExpiry(refreshed.accessToken),
    refreshToken: refreshed.refreshToken ?? token.refreshToken,
    error: undefined,
    ...(Array.isArray(newPayload.permissions) && {
      permissions: newPayload.permissions,
    }),
    ...(typeof newPayload.email_verified === "boolean" && {
      emailVerified: newPayload.email_verified,
    }),
    ...(typeof newPayload.phone_verified === "boolean" && {
      phoneVerified: newPayload.phone_verified,
    }),
    ...(typeof newPayload.provider_verification_status === "string" && {
      providerVerificationStatus: newPayload.provider_verification_status,
    }),
  };

  // Re-encode the token as a NextAuth-compatible JWT
  const encoded = await encode({
    token: newToken,
    secret,
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  const cookieName = isHttps
    ? "__Secure-next-auth.session-token"
    : "next-auth.session-token";

  const response = NextResponse.json({ accessToken: refreshed.accessToken });

  response.cookies.set(cookieName, encoded, {
    httpOnly: true,
    secure: isHttps,
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: "/",
  });

  return response;
}
