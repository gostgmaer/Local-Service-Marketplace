import {
  IsString,
  IsNumber,
  IsOptional,
  IsUUID,
  MinLength,
  Min,
  Max,
  IsObject,
  ValidateNested,
  IsArray,
  IsEnum,
  IsDateString,
  ArrayMaxSize,
  IsUrl,
  Matches,
} from "class-validator";
import { Type, Transform, plainToInstance } from "class-transformer";

/**
 * Represents a single uploaded image attached to a service request.
 * The file-upload-service assigns the id; the url is the public CDN URL.
 */
export class RequestImageDto {
  @IsUUID()
  id: string;

  @IsUrl({}, { message: "Image URL must be a valid URL" })
  url: string;
}

export class LocationDto {
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude: number;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{6}$/, { message: "Pincode must be a 6-digit number" })
  pincode?: string;

  @IsOptional()
  @IsString()
  district?: string;

  @IsOptional()
  @IsString()
  country?: string;
}

export class CreateRequestDto {
  @IsOptional()
  @IsString()
  user_id?: string;

  @IsOptional()
  @IsObject()
  @Transform(({ value }) =>
    typeof value === "string" ? JSON.parse(value) : value,
  )
  guest_info?: {
    name: string;
    email: string;
    phone: string;
  };

  @IsString()
  category_id: string;

  @IsOptional()
  @IsObject()
  @Transform(({ value }) => {
    const obj = typeof value === "string" ? JSON.parse(value) : value;
    return plainToInstance(LocationDto, obj);
  })
  @ValidateNested()
  @Type(() => LocationDto)
  location?: LocationDto;

  @IsString()
  @MinLength(10)
  description: string;

  @IsNumber()
  @Min(0)
  @Transform(({ value }) => (typeof value === "string" ? Number(value) : value))
  budget: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @Transform(({ value }) => {
    if (!Array.isArray(value)) return value;
    // Filter out empty/placeholder objects (from multipart form or client-side placeholders)
    return value.filter((img: any) => img && img.id && img.url);
  })
  @ValidateNested({ each: true })
  @Type(() => RequestImageDto)
  images?: RequestImageDto[];

  @IsOptional()
  @IsDateString()
  preferred_date?: string;

  @IsOptional()
  @IsEnum(["low", "medium", "high", "urgent"])
  urgency?: "low" | "medium" | "high" | "urgent";

  @IsOptional()
  @IsDateString()
  expiry_date?: string;
}
