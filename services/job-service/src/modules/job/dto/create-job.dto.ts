import { IsUUID } from 'class-validator';

export class CreateJobDto {
  @IsUUID()
  request_id: string;

  @IsUUID()
  provider_id: string;
}
