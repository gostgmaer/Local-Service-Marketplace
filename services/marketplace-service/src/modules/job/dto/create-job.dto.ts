import { IsUUID, IsOptional, IsNumber, Min } from 'class-validator';

export class CreateJobDto {
	@IsUUID()
	request_id: string;

	@IsUUID()
	provider_id: string;

	// Set by controller from authenticated user headers — not accepted from body
	customer_id?: string;

	@IsOptional()
	@IsUUID()
	proposal_id?: string;

	@IsOptional()
	@IsNumber()
	@Min(1)
	actual_amount?: number;
}
