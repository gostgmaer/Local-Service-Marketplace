import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService as NestJwtService } from "@nestjs/jwt";
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
      expiresIn: this.configService.get<string>("JWT_EXPIRATION", "15m"),
    });
  }

  async generateRefreshToken(
    userId: string,
    email: string,
    role: string,
    providerId?: string,
  ): Promise<string> {
    const payload: JwtPayload = { sub: userId, email, role };
    if (providerId) payload.providerId = providerId;
    return this.jwtService.sign(payload, {
      secret: this.configService.get<string>("JWT_REFRESH_SECRET"),
      expiresIn: this.configService.get<string>("JWT_REFRESH_EXPIRATION", "7d"),
    });
  }

  verifyAccessToken(token: string): JwtPayload {
    return this.jwtService.verify(token, {
      secret: this.configService.get<string>("JWT_SECRET"),
    });
  }

  verifyRefreshToken(token: string): JwtPayload {
    return this.jwtService.verify(token, {
      secret: this.configService.get<string>("JWT_REFRESH_SECRET"),
    });
  }
}
