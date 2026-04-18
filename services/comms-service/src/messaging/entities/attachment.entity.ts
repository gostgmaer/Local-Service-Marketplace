export class Attachment {
  id: string;
  message_id: string;
  /**
   * File service ObjectID — resolve via GET /api/v1/files/:file_id with JWT.
   * Never expose the raw Azure Blob URL; always go through the authenticated gateway.
   */
  file_id: string;
  /** @deprecated Retained for legacy records only. New records set this to null. */
  file_url?: string | null;
  file_name?: string;
  file_size?: number;
  mime_type?: string;
  created_at: Date;

  constructor(partial: Partial<Attachment>) {
    Object.assign(this, partial);
  }
}
