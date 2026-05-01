import { IsString, IsNotEmpty, IsOptional } from "class-validator";

export class SendSmsDto {
  @IsString()
  @IsNotEmpty()
  phone: string;

  @IsString()
  @IsNotEmpty()
  message: string;

  @IsString()
  @IsOptional()
  purpose?: string; // e.g., 'otp', 'notification', 'alert'
}


