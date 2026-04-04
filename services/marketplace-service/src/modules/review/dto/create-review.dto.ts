import { IsNotEmpty, IsString, IsInt, Min, Max, IsUUID, IsOptional } from "class-validator";

export class CreateReviewDto {
	@IsNotEmpty()
	@IsUUID()
	job_id: string;

	// Set by controller from authenticated user headers — not accepted from body
	user_id: string;

	@IsNotEmpty()
	@IsUUID()
	provider_id: string;

	@IsNotEmpty()
	@IsInt()
	@Min(1)
	@Max(5)
	rating: number;

	@IsNotEmpty()
	@IsString()
	comment: string;
}
