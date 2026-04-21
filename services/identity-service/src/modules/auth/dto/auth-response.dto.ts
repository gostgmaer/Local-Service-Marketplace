export class AuthResponseDto {
  message?: string;
  // Present when login succeeds normally
  accessToken?: string;
  refreshToken?: string;
  user?: {
    id: string;
    email: string;
    display_id?: string;
    name?: string;
    role: string;
    email_verified: boolean;
    phone_verified: boolean; // ✅ NEW
    profile_picture_url?: string; // ✅ NEW
    timezone: string; // ✅ NEW
    language: string; // ✅ NEW
    last_login_at?: Date; // ✅ NEW
  };
  // Present when the account has 2FA enabled — client must complete the challenge
  requiresMfa?: boolean;
  mfaToken?: string;
}
