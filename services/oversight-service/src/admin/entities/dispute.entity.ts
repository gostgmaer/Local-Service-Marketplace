export class Dispute {
  id: string;
  display_id: string;
  job_id: string;
  opened_by: string;
  reason: string;
  description?: string;
  /** Array of { id, url } objects stored as JSONB — evidence images uploaded by the claimant */
  evidence_images?: { id: string; url: string }[];
  status: string;
  resolution?: string;
  resolved_by?: string;
  resolved_at?: Date;
  created_at: Date;
  updated_at?: Date;
}
