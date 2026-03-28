import { IsEnum, IsOptional, IsString } from "class-validator";
import { ListQueryDto } from "./list-query.dto";

export enum EventSortBy {
	CREATED_AT = "createdAt",
	EVENT_TYPE = "eventType",
}

export class EventQueryDto extends ListQueryDto {
	@IsOptional()
	@IsString()
	eventType?: string;

	@IsOptional()
	@IsEnum(EventSortBy)
	sortBy?: EventSortBy = EventSortBy.CREATED_AT;
}
