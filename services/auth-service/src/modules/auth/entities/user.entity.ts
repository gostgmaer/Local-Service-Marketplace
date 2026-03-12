export class User {
  id: string;
  email: string;
  phone?: string;
  password_hash?: string;
  role: string;
  email_verified: boolean;
  status: string;
  created_at: Date;
  updated_at?: Date;
}
