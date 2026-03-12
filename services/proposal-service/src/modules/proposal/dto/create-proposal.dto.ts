import { IsString, IsNumber, IsUUID, MinLength, Min } from 'class-validator';

export class CreateProposalDto {
  @IsUUID()
  request_id: string;

  @IsUUID()
  provider_id: string;

  @IsNumber()
  @Min(0)
  price: number;

  @IsString()
  @MinLength(10)
  message: string;
}
