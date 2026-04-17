import { IsNotEmpty, IsString, IsOptional, IsObject } from "class-validator";

export class CreateEventDto {
  @IsNotEmpty()
  @IsString()
  eventType: string;

  @IsOptional()
  @IsObject()
  payload?: any;
}
