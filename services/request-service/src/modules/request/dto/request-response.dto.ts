import { ServiceRequest } from '../entities/service-request.entity';

export class RequestResponseDto {
  id: string;
  user_id: string;
  category_id: string;
  location_id?: string;
  description: string;
  budget: number;
  status: string;
  created_at: Date;

  static fromEntity(request: ServiceRequest): RequestResponseDto {
    return {
      id: request.id,
      user_id: request.user_id,
      category_id: request.category_id,
      location_id: request.location_id,
      description: request.description,
      budget: request.budget,
      status: request.status,
      created_at: request.created_at,
    };
  }
}

export class PaginatedRequestResponseDto {
  data: RequestResponseDto[];
  nextCursor?: string;
  hasMore: boolean;

  constructor(data: RequestResponseDto[], nextCursor?: string, hasMore = false) {
    this.data = data;
    this.nextCursor = nextCursor;
    this.hasMore = hasMore;
  }
}
