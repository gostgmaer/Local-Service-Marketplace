import { IsUUID, IsString, IsNotEmpty } from 'class-validator';

export class CreateMessageDto {
  @IsUUID()
  jobId: string;

  @IsUUID()
  senderId: string;

  @IsString()
  @IsNotEmpty()
  message: string;
}
