export class BackgroundJob {
  id: string;
  job_type: string;
  payload: any;
  status: string;
  attempts: number;
  last_error?: string;
  created_at: Date;
  updated_at?: Date;
  scheduled_for: Date;
}
