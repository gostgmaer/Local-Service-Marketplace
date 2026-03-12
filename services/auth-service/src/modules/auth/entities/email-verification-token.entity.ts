export class EmailVerificationToken {
  id: string;
  user_id: string;
  token: string;
  expires_at: Date;
}
