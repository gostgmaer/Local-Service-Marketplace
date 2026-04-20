import { Proposal } from "../entities/proposal.entity";

export class ProposalResponseDto {
  id: string;
  display_id?: string;
  request_id: string;
  provider_id: string;
  price: number;
  message: string;
  status: string;
  estimated_hours?: number;
  start_date?: Date;
  completion_date?: Date;
  rejected_reason?: string;
  created_at: Date;
  updated_at?: Date;
  provider?: { id: string; name: string; rating?: number; review_count?: number };

  static fromEntity(proposal: Proposal): ProposalResponseDto {
    return {
      id: proposal.id,
      display_id: proposal.display_id,
      request_id: proposal.request_id,
      provider_id: proposal.provider_id,
      price: proposal.price,
      message: proposal.message,
      status: proposal.status,
      estimated_hours: proposal.estimated_hours ?? undefined,
      start_date: proposal.start_date ?? undefined,
      completion_date: proposal.completion_date ?? undefined,
      rejected_reason: proposal.rejected_reason ?? undefined,
      created_at: proposal.created_at,
      updated_at: (proposal as any).updated_at ?? undefined,
      provider: (proposal as any).provider_name
        ? {
            id: proposal.provider_id,
            name: (proposal as any).provider_name,
            rating: (proposal as any).provider_rating
              ? parseFloat((proposal as any).provider_rating)
              : undefined,
            review_count: (proposal as any).provider_review_count
              ? parseInt((proposal as any).provider_review_count, 10)
              : undefined,
          }
        : undefined,
    };
  }
}

export class PaginatedProposalResponseDto {
  data: ProposalResponseDto[];
  total?: number;
  page?: number;
  limit?: number;
  nextCursor?: string;
  hasMore?: boolean;

  constructor(
    data: ProposalResponseDto[],
    nextCursor?: string,
    hasMore = false,
    total?: number,
    page?: number,
    limit?: number,
  ) {
    this.data = data;
    this.total = total;
    this.page = page;
    this.limit = limit;
    this.nextCursor = nextCursor;
    this.hasMore = hasMore;
  }
}
