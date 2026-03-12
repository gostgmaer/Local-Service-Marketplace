export class Session {
  id: string;
  user_id: string;
  refresh_token: string;
  ip_address?: string;
  user_agent?: string;
  expires_at: Date;
  created_at: Date;
}
