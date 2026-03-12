export class LoginAttempt {
  id: string;
  email: string;
  ip_address?: string;
  success: boolean;
  created_at: Date;
}
