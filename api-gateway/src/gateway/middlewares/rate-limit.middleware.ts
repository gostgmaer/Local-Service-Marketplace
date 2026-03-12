import { Injectable, NestMiddleware, Inject, LoggerService } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import rateLimit from 'express-rate-limit';

@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  private limiter: any;

  constructor(
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger: LoggerService,
  ) {
    // Configure rate limiter
    this.limiter = rateLimit({
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60000, // 1 minute
      max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // 100 requests per window
      message: 'Too many requests from this IP, please try again later.',
      standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
      legacyHeaders: false, // Disable the `X-RateLimit-*` headers
      keyGenerator: (req: Request) => {
        // Use user ID if authenticated, otherwise use IP
        const user = (req as any).user;
        return user?.userId || req.ip;
      },
      handler: (req: Request, res: Response) => {
        this.logger.warn(
          `Rate limit exceeded for ${(req as any).user?.userId || req.ip} on ${req.path}`,
          'RateLimitMiddleware',
        );
        res.status(429).json({
          statusCode: 429,
          message: 'Too many requests, please try again later.',
          timestamp: new Date().toISOString(),
        });
      },
    });
  }

  use(req: Request, res: Response, next: NextFunction) {
    this.limiter(req, res, next);
  }
}
