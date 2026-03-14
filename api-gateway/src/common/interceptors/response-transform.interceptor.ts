import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  HttpStatus,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Request, Response } from 'express';

export interface StandardResponse<T = any> {
  success: boolean;
  statusCode: number;
  message: string;
  data?: T;
  total?: number;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

@Injectable()
export class ResponseTransformInterceptor<T>
  implements NestInterceptor<T, StandardResponse<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<StandardResponse<T>> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    return next.handle().pipe(
      map((data) => {
        const statusCode = response.statusCode;
        const method = request.method;
        const path = request.path;

        // Determine if response is already wrapped
        if (data && typeof data === 'object' && 'success' in data && 'statusCode' in data) {
          return data as StandardResponse<T>;
        }

        // Extract data and metadata
        let responseData = data;
        let total: number | undefined;
        let message = this.generateMessage(method, statusCode, path);

        // Handle paginated responses
        if (data && typeof data === 'object') {
          if ('data' in data && 'nextCursor' in data) {
            // Paginated response from services
            responseData = data.data;
            total = data.data?.length;
          } else if ('items' in data && 'total' in data) {
            // Alternative pagination format
            responseData = data.items;
            total = data.total;
          } else if (Array.isArray(data)) {
            // Plain array response
            total = data.length;
          }
        }

        // Build standardized response
        const standardResponse: StandardResponse<T> = {
          success: statusCode >= 200 && statusCode < 300,
          statusCode,
          message,
          data: responseData,
        };

        // Add total count for list responses
        if (total !== undefined) {
          standardResponse.total = total;
        }

        return standardResponse;
      }),
    );
  }

  private generateMessage(method: string, statusCode: number, path: string): string {
    // Extract resource name from path
    const pathParts = path.split('/').filter(Boolean);
    const resource = pathParts[pathParts.length - 1] || 'resource';

    switch (method) {
      case 'POST':
        if (statusCode === HttpStatus.CREATED) {
          return `${this.capitalize(resource)} created successfully`;
        }
        return `${this.capitalize(resource)} processed successfully`;
      
      case 'GET':
        if (Array.isArray(path.match(/\/\w+$/))) {
          return `${this.capitalize(resource)} retrieved successfully`;
        }
        return `${this.capitalize(resource)} retrieved successfully`;
      
      case 'PATCH':
      case 'PUT':
        return `${this.capitalize(resource)} updated successfully`;
      
      case 'DELETE':
        return `${this.capitalize(resource)} deleted successfully`;
      
      default:
        return 'Request processed successfully';
    }
  }

  private capitalize(str: string): string {
    // Handle UUIDs and special cases
    if (str.match(/^[a-f0-9-]{36}$/i)) {
      return 'Resource';
    }
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}
