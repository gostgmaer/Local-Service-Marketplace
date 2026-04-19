import { IsNotEmpty, IsString, IsIn, IsOptional } from "class-validator";

export class UpdateDisputeDto {
  @IsNotEmpty()
  @IsString()
  @IsIn(["investigating", "resolved", "closed"], {
    message: 'Status must be one of: investigating, resolved, closed',
  })
  status: string;

  @IsOptional()
  @IsString()
  resolution?: string;
}
