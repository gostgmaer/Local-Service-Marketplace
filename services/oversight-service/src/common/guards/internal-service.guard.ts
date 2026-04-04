import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { UnauthorizedException } from '../exceptions/http.exceptions';

/**
 * InternalServiceGuard
 *
 * Protects endpoints that are only meant to be called by other trusted microservices
 * (not by end users through the API Gateway).
 *
 * The calling service must supply the shared internal secret in the header:
 *   x-internal-secret: <GATEWAY_INTERNAL_SECRET value>
 *
 * This secret is already in the environment of every service (set in docker-compose.yml
 * via docker.env), so no extra configuration is needed.
 */
@Injectable()
export class InternalServiceGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const secret = request.headers['x-internal-secret'];
    const expected = process.env.GATEWAY_INTERNAL_SECRET;

    if (!expected) {
      // If the secret is not configured, reject all internal calls to avoid silent bypass
      throw new UnauthorizedException('Internal service secret not configured');
    }

    if (!secret || secret !== expected) {
      throw new UnauthorizedException('Invalid or missing internal service secret');
    }

    return true;
  }
}
