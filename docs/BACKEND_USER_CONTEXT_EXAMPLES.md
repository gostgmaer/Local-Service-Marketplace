/**
 * Example: How to use user context headers in backend services
 * 
 * Both token validation strategies (local & API) forward the same user headers:
 * - x-user-id
 * - x-user-email
 * - x-user-role
 * - x-user-name (optional)
 * - x-user-phone (optional)
 */

// ============================================
// Method 1: Direct Header Access
// ============================================

import { Controller, Get, Headers } from '@nestjs/common';

@Controller('requests')
export class RequestController {
  
  @Get('/my-requests')
  async getMyRequests(
    @Headers('x-user-id') userId: string,
    @Headers('x-user-role') role: string,
    @Headers('x-user-email') email: string,
  ) {
    console.log(`User ${userId} (${role}) fetching their requests`);
    
    // No JWT validation needed - gateway already verified!
    return this.requestService.findByUserId(userId);
  }

  @Post('/create')
  async createRequest(
    @Headers('x-user-id') userId: string,
    @Headers('x-user-email') email: string,
    @Body() createDto: CreateRequestDto,
  ) {
    return this.requestService.create({
      ...createDto,
      userId,
      userEmail: email,
    });
  }
}

// ============================================
// Method 2: Custom Decorator (Recommended)
// ============================================

// decorators/current-user.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface CurrentUserData {
  userId: string;
  email: string;
  role: string;
  name?: string;
  phone?: string;
}

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): CurrentUserData => {
    const request = ctx.switchToHttp().getRequest();
    return {
      userId: request.headers['x-user-id'],
      email: request.headers['x-user-email'],
      role: request.headers['x-user-role'],
      name: request.headers['x-user-name'],
      phone: request.headers['x-user-phone'],
    };
  },
);

// Usage in controller:
@Controller('requests')
export class RequestController {
  
  @Get('/my-requests')
  async getMyRequests(@CurrentUser() user: CurrentUserData) {
    console.log(`User ${user.userId} (${user.role}) fetching requests`);
    return this.requestService.findByUserId(user.userId);
  }

  @Post('/create')
  async createRequest(
    @CurrentUser() user: CurrentUserData,
    @Body() createDto: CreateRequestDto,
  ) {
    // Clean, readable code!
    return this.requestService.create({
      ...createDto,
      userId: user.userId,
      userEmail: user.email,
    });
  }
}

// ============================================
// Method 3: Guard for Role-Based Access
// ============================================

// guards/roles.guard.ts
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

export const Roles = (...roles: string[]) => SetMetadata('roles', roles);

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.get<string[]>('roles', context.getHandler());
    if (!requiredRoles) {
      return true; // No roles required
    }

    const request = context.switchToHttp().getRequest();
    const userRole = request.headers['x-user-role'];

    if (!userRole || !requiredRoles.includes(userRole)) {
      throw new ForbiddenException('You do not have permission to access this resource');
    }

    return true;
  }
}

// Usage in controller:
@Controller('admin')
@UseGuards(RolesGuard)
export class AdminController {
  
  @Get('/users')
  @Roles('admin', 'super_admin')
  async getAllUsers(@CurrentUser() user: CurrentUserData) {
    // Only admins can access this
    return this.adminService.getAllUsers();
  }

  @Delete('/users/:id')
  @Roles('super_admin')
  async deleteUser(@Param('id') id: string) {
    // Only super admins can delete
    return this.adminService.deleteUser(id);
  }
}

// ============================================
// Method 4: Middleware for Additional Logging
// ============================================

// middleware/user-context.middleware.ts
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class UserContextMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // Extract user from headers and attach to request
    (req as any).currentUser = {
      userId: req.headers['x-user-id'],
      email: req.headers['x-user-email'],
      role: req.headers['x-user-role'],
      name: req.headers['x-user-name'],
      phone: req.headers['x-user-phone'],
    };

    // Log user context for debugging
    console.log(`[${req.method}] ${req.path} - User: ${(req as any).currentUser.userId}`);

    next();
  }
}

// Apply in module:
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(UserContextMiddleware)
      .forRoutes('*');
  }
}

// ============================================
// Testing Examples
// ============================================

describe('RequestController', () => {
  it('should get user requests', async () => {
    const result = await request(app.getHttpServer())
      .get('/requests/my-requests')
      .set('x-user-id', 'test-user-123')
      .set('x-user-email', 'test@example.com')
      .set('x-user-role', 'user')
      .expect(200);

    expect(result.body).toBeDefined();
  });

  it('should deny access without user headers', async () => {
    await request(app.getHttpServer())
      .get('/requests/my-requests')
      .expect(401); // Or 403 depending on your error handling
  });

  it('should create request with user context', async () => {
    const result = await request(app.getHttpServer())
      .post('/requests/create')
      .set('x-user-id', 'test-user-123')
      .set('x-user-email', 'test@example.com')
      .set('x-user-role', 'user')
      .send({
        title: 'Need plumber',
        description: 'Leaky faucet',
      })
      .expect(201);

    expect(result.body.userId).toBe('test-user-123');
  });
});

// ============================================
// Summary
// ============================================

/**
 * Key Points:
 * 
 * 1. NO JWT VALIDATION NEEDED in backend services
 *    - Gateway already verified the token
 *    - Just read the headers
 * 
 * 2. Headers are ALWAYS present (both validation strategies)
 *    - x-user-id: Always present
 *    - x-user-email: Always present
 *    - x-user-role: Always present
 *    - x-user-name: Optional
 *    - x-user-phone: Optional
 * 
 * 3. Use @CurrentUser() decorator for clean code
 *    - Type-safe
 *    - Reusable
 *    - Easy to test
 * 
 * 4. Implement RBAC with Guards
 *    - Check x-user-role header
 *    - Throw ForbiddenException if unauthorized
 * 
 * 5. Testing is simple
 *    - Just set the headers in your tests
 *    - No need to generate real JWT tokens
 */
