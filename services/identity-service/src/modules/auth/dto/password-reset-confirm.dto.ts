import { IsString, MinLength, Matches } from "class-validator";

export class PasswordResetConfirmDto {
  @IsString()
  token: string;

  @IsString()
  @MinLength(8, { message: "Password must be at least 8 characters long" })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9])/, {
    message:
      "Password must contain at least one uppercase letter, one lowercase letter, one digit, and one special character",
  })
  newPassword: string;
}
