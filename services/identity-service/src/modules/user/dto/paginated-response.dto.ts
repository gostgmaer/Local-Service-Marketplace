export class PaginatedResponseDto<T> {
  data: T[];
  // Cursor-based fields
  nextCursor?: string;
  hasMore?: boolean;
  // Page-based fields (used by interceptor to build numeric meta)
  total?: number;
  page?: number;
  limit?: number;
}
