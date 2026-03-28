import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/**
 * Roles Decorator
 * 
 * Use this decorator to specify which user roles can access an endpoint.
 * 
 * @param roles - Array of allowed roles ('admin', 'provider', 'customer')
 * 
 * @example
 * ```typescript
 * @Roles('admin')
 * @UseGuards(JwtAuthGuard, RolesGuard)
 * @Get('admin/events')
 * getEvents() { ... }
 * ```
 * 
 * @example Multiple roles
 * ```typescript
 * @Roles('admin', 'provider')
 * @UseGuards(JwtAuthGuard, RolesGuard)
 * @Get('events')
 * getEvents() { ... }
 * ```
 */
export const Roles = (...roles: string[]) =>
  SetMetadata(ROLES_KEY, roles);
