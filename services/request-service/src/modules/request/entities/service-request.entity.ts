import { Location } from './location.entity';

export class ServiceRequest {
  id: string;
  user_id: string;
  category_id: string;
  location_id?: string;
  location?: Location;
  description: string;
  budget: number;
  images?: string[];                    // ✅ NEW (JSONB)
  preferred_date?: Date;                // ✅ NEW
  urgency: string;                      // ✅ NEW ('low', 'medium', 'high', 'urgent')
  expiry_date?: Date;                   // ✅ NEW
  view_count: number;                   // ✅ NEW
  status: string;
  created_at: Date;
  updated_at?: Date;                    // ✅ NEW
  deleted_at?: Date;                    // ✅ NEW
}
