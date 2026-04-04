import { IsUUID, IsString, IsNotEmpty, IsOptional } from "class-validator";

export class CreateMessageDto {
	@IsUUID()
	job_id: string;

	@IsOptional()
	@IsUUID()
	sender_id?: string;

	@IsString()
	@IsNotEmpty()
	message: string;
}
