import { IsString, IsNotEmpty, IsOptional, MaxLength, MinLength } from "class-validator";
import { Transform } from "class-transformer";

export class CreateMessageDto {
  @IsString()
  job_id: string;

  @IsOptional()
  @IsString()
  sender_id?: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(1, { message: 'Message cannot be empty' })
  @MaxLength(5000, { message: 'Message cannot exceed 5000 characters' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  message: string;
}
