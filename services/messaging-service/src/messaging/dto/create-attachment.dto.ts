import { IsString, IsUUID, IsUrl } from 'class-validator';

export class CreateAttachmentDto {
  @IsString()
  entityType: string;

  @IsUUID()
  entityId: string;

  @IsUrl()
  fileUrl: string;
}
