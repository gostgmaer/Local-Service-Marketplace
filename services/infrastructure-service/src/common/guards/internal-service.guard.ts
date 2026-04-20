import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from "@nestjs/common";
import * as crypto from "crypto";

@Injectable()
export class InternalServiceGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const secret = request.headers["x-internal-secret"];
    const expected = process.env.GATEWAY_INTERNAL_SECRET;

    if (!expected) {
      throw new UnauthorizedException("Internal service secret not configured");
    }

    const secretBuf = Buffer.from(secret ?? "", "utf8");
    const expectedBuf = Buffer.from(expected, "utf8");
    const isValid =
      secretBuf.length === expectedBuf.length &&
      crypto.timingSafeEqual(secretBuf, expectedBuf);

    if (!isValid) {
      throw new UnauthorizedException("Invalid or missing internal service secret");
    }

    return true;
  }
}
