export class PasswordResetToken {
  id: string;
  user_id: string;
  token: string;
  expires_at: Date;
}
