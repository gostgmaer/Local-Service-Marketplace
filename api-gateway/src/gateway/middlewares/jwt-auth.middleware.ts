import { Injectable, NestMiddleware, Inject, LoggerService } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import * as jwt from 'jsonwebtoken';
import { UnauthorizedException } from '../../common/exceptions/http.exceptions';
import { publicRoutes } from '../config/services.config';

@Injectable()
export class JwtAuthMiddleware implements NestMiddleware {
  constructor(
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger: LoggerService,
  ) {}

  use(req: Request, res: Response, next: NextFunction) {
    const path = req.path;

    // Check if route is public
    const isPublicRoute = publicRoutes.some((route) => path.startsWith(route));

    if (isPublicRoute) {
      return next();
    }

    // Extract JWT token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      this.logger.error(
        `Missing or invalid Authorization header for ${path}`,
        'JwtAuthMiddleware',
      );
      throw new UnauthorizedException('Missing or invalid authorization token');
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    try {
      // Verify JWT token
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production');

      // Attach user info to request
      (req as any).user = decoded;

      this.logger.log(
        `JWT verified for user: ${(decoded as any).userId || 'unknown'}`,
        'JwtAuthMiddleware',
      );

      next();
    } catch (error) {
      this.logger.error(
        `JWT verification failed: ${error.message}`,
        error.stack,
        'JwtAuthMiddleware',
      );
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
