import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService as NestJwtService } from "@nestjs/jwt";
import { randomBytes, randomUUID } from "crypto";
import { RbacService } from "../../rbac/rbac.service";

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  permissions?: string[];
  providerId?: string;
  email_verified?: boolean;
  phone_verified?: boolean;
}

@Injectable()
export class JwtService {
  /**
   * Prefix embeds token type + version. Bump to "v2" to invalidate all v1 tokens.
   * Final token format: `lsm_rt_v1_{uuid}_{64hex}`
   *   - uuid  → unique token ID (safe to log, use for correlation)
   *   - 64hex → 256-bit secret (never log this part)
   */
  private static readonly REFRESH_TOKEN_PREFIX = "lsm_rt_v1_";

  constructor(
    private readonly jwtService: NestJwtService,
    private readonly configService: ConfigService,
    private readonly rbacService: RbacService,
  ) {}

  async generateAccessToken(
    userId: string,
    email: string,
    role: string,
    providerId?: string,
    emailVerified?: boolean,
    phoneVerified?: boolean,
  ): Promise<string> {
    const permissions = await this.rbacService.getPermissionsForRole(role);
    const payload: JwtPayload = { sub: userId, email, role, permissions };
    if (providerId) payload.providerId = providerId;
    if (emailVerified !== undefined) payload.email_verified = emailVerified;
    if (phoneVerified !== undefined) payload.phone_verified = phoneVerified;
    return this.jwtService.sign(payload, {
      secret: this.configService.get<string>("JWT_SECRET"),
      // Support both JWT_EXPIRATION and JWT_EXPIRES_IN (fallback chain)
      expiresIn:
        this.configService.get<string>("JWT_EXPIRATION") ||
        this.configService.get<string>("JWT_EXPIRES_IN", "1d"),
    });
  }

  /**
   * Generates a cryptographically random opaque refresh token.
   *
   * Format: `lsm_rt_v1_{64 hex chars}`
   *
   * - `lsm_rt`  — identifies this as a Local Service Marketplace refresh token
   * - `v1`      — version tag; bump to v2 to instantly invalidate all v1 tokens
   * - random    — 32 bytes (256-bit) of entropy; the actual secret
   *
   * No expiry or user claims are embedded — all session metadata lives in the
   * database (`sessions.expires_at`).  The client holds the raw token; only a
   * SHA-256 hash is stored in the DB so a breach does not expose live sessions.
   */
  generateRefreshToken(): string {
    const tokenId = randomUUID(); // unique, safe to log
    const secret = randomBytes(32).toString("hex"); // 256-bit secret, never log
    return `${JwtService.REFRESH_TOKEN_PREFIX}${tokenId}_${secret}`;
  }

  verifyAccessToken(token: string): JwtPayload {
    return this.jwtService.verify(token, {
      secret: this.configService.get<string>("JWT_SECRET"),
    });
  }
}
