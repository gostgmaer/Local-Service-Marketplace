export class PaginatedResponseDto<T> {
	data: T[];
	nextCursor?: string;
	hasMore: boolean;
}
