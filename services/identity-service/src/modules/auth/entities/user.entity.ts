export class User {
  id: string;
  email: string;
  name?: string;
  phone?: string;
  password_hash: string;
  role: string;
  email_verified: boolean;
  phone_verified: boolean;
  profile_picture_url?: string;
  timezone: string;
  language: string;
  last_login_at?: Date;
  status: string;
  created_at: Date;
  updated_at?: Date;
  deleted_at?: Date;
}
