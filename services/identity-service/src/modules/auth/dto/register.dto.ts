import {
	IsEmail,
	IsString,
	MinLength,
	MaxLength,
	IsEnum,
	IsOptional,
	ValidateIf,
	IsMobilePhone,
	Matches,
	IsNotEmpty,
} from "class-validator";
import { Transform } from "class-transformer";
import { UserRole } from "./signup.dto";

export class RegisterDto {
	@ValidateIf((o) => !o.phone)
	@IsEmail({}, { message: "A valid email is required when phone is not provided" })
	@Transform(({ value }) => (typeof value === "string" ? value.trim().toLowerCase() : value))
	email?: string;

	@ValidateIf((o) => !o.email)
	@IsMobilePhone(
		null,
		{ strictMode: false },
		{ message: "A valid phone number is required when email is not provided" },
	)
	@Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
	phone?: string;

	@IsOptional()
	@IsString()
	@MaxLength(100, { message: "Name must not exceed 100 characters" })
	@Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
	name?: string;

	/**
	 * Password rules (only validated if provided — omit to auto-generate):
	 * - 8–64 characters
	 * - At least one uppercase letter (A-Z)
	 * - At least one lowercase letter (a-z)
	 * - At least one digit (0-9)
	 * - At least one special character (!@#$%^&*...)
	 * - No whitespace
	 */
	@IsOptional()
	@IsString()
	@MinLength(8, { message: "Password must be at least 8 characters long" })
	@MaxLength(64, { message: "Password must not exceed 64 characters" })
	@Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~])[^\s]{8,}$/, {
		message:
			"Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character, with no spaces",
	})
	password?: string;

	@IsOptional()
	@IsEnum(UserRole, { message: "User type must be customer or provider" })
	userType?: UserRole = UserRole.CUSTOMER;
}

export class RegisterResponseDto {
	message: string;
	email?: string;
	emailSent: boolean;
	verificationEmailSent: boolean;
}
