import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  HttpStatus,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";

export interface PaginationMeta {
  page?: number;
  limit?: number;
  total?: number;
  totalPages?: number;
  nextCursor?: string | null;
  hasMore?: boolean;
}

export interface StandardResponse<T = any> {
  success: boolean;
  statusCode: number;
  message: string;
  data: T;
  meta: PaginationMeta | null;
}

@Injectable()
export class ResponseTransformInterceptor<T> implements NestInterceptor<
  T,
  StandardResponse<T>
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<StandardResponse<T>> {
    const ctx = context.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    return next.handle().pipe(
      map((data) => {
        const statusCode = response.statusCode || HttpStatus.OK;
        const method = request.method;

        // If response is already in standardized format, return as is
        if (
          data &&
          typeof data === "object" &&
          "success" in data &&
          "statusCode" in data &&
          "meta" in data
        ) {
          return data as StandardResponse<T>;
        }

        // If controller returned { success, data?, message?, statusCode?, meta? } partial format, unwrap it
        if (
          data &&
          typeof data === "object" &&
          "success" in data &&
          typeof (data as any).success === "boolean"
        ) {
          const partial = data as any;
          let innerData = partial.data ?? null;
          let innerMeta = partial.meta ?? null;

          // Detect pagination inside partial.data to avoid data.data nesting
          if (innerData && typeof innerData === "object" && !innerMeta) {
            if ("data" in innerData && "total" in innerData) {
              const query = request.query || {};
              const page = parseInt(query.page as string) || 1;
              const limit = parseInt(query.limit as string) || 20;
              const total = innerData.total as number;
              innerMeta = { page: innerData.page ?? page, limit: innerData.limit ?? limit, total, totalPages: Math.ceil(total / (innerData.limit ?? limit)) };
              innerData = innerData.data;
            } else if ("data" in innerData && "nextCursor" in innerData) {
              innerMeta = { nextCursor: innerData.nextCursor ?? null, hasMore: innerData.hasMore ?? false };
              innerData = innerData.data;
            }
          }

          return {
            success: partial.success,
            statusCode: partial.statusCode || statusCode,
            message:
              typeof partial.message === "string"
                ? partial.message
                : this.generateMessage(method, statusCode),
            data: innerData,
            meta: innerMeta,
          } as StandardResponse<T>;
        }

        // Extract custom message if provided by controller
        let customMessage: string | undefined;
        let rawData: any = data;
        if (
          rawData &&
          typeof rawData === "object" &&
          typeof rawData.message === "string"
        ) {
          customMessage = rawData.message;
          const rest = { ...rawData };
          delete rest.message;
          rawData = rest;
        }

        // Extract data and metadata
        let responseData: any = rawData;
        let meta: PaginationMeta | null = null;

        // Handle paginated responses
        if (rawData && typeof rawData === "object") {
          const query = request.query || {};
          const page = parseInt(query.page as string) || 1;
          const limit = parseInt(query.limit as string) || 20;

          if ("data" in rawData && "total" in rawData) {
            // Offset-based pagination: { data, total, page?, limit? }
            responseData = (rawData as any).data;
            const total = (rawData as any).total as number;
            const currentPage = (rawData as any).page
              ? parseInt((rawData as any).page)
              : page;
            const currentLimit = (rawData as any).limit
              ? parseInt((rawData as any).limit)
              : limit;
            meta = {
              page: currentPage,
              limit: currentLimit,
              total,
              totalPages: Math.ceil(total / currentLimit),
            };
          } else if ("items" in rawData && "total" in rawData) {
            // Alternative pagination: { items, total }
            responseData = (rawData as any).items;
            const total = (rawData as any).total as number;
            const currentPage = (rawData as any).page
              ? parseInt((rawData as any).page)
              : page;
            const currentLimit = (rawData as any).limit
              ? parseInt((rawData as any).limit)
              : limit;
            meta = {
              page: currentPage,
              limit: currentLimit,
              total,
              totalPages: Math.ceil(total / currentLimit),
            };
          } else if ("data" in rawData && "nextCursor" in rawData) {
            // Cursor-based pagination
            responseData = (rawData as any).data;
            meta = {
              nextCursor: (rawData as any).nextCursor ?? null,
              hasMore: (rawData as any).hasMore ?? false,
            };
          }
        }

        return {
          success: statusCode >= 200 && statusCode < 300,
          statusCode,
          message: customMessage ?? this.generateMessage(method, statusCode),
          data: responseData ?? null,
          meta,
        } as StandardResponse<T>;
      }),
    );
  }

  private generateMessage(method: string, statusCode: number): string {
    if (statusCode === HttpStatus.CREATED) {
      return "Resource created successfully";
    }
    if (statusCode === HttpStatus.NO_CONTENT) {
      return "Resource deleted successfully";
    }

    switch (method) {
      case "GET":
        return "Resource retrieved successfully";
      case "POST":
        return "Resource created successfully";
      case "PATCH":
      case "PUT":
        return "Resource updated successfully";
      case "DELETE":
        return "Resource deleted successfully";
      default:
        return "Request processed successfully";
    }
  }
}
