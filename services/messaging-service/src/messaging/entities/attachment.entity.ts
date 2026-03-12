export class Attachment {
  id: string;
  entityType: string;
  entityId: string;
  fileUrl: string;

  constructor(partial: Partial<Attachment>) {
    Object.assign(this, partial);
  }
}
