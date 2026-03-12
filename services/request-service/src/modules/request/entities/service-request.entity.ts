export class ServiceRequest {
  id: string;
  user_id: string;
  category_id: string;
  location_id?: string;
  description: string;
  budget: number;
  status: string;
  created_at: Date;
}
