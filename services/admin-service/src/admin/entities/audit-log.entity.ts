export class AuditLog {
  id: string;
  userId: string;
  action: string;
  entity: string;
  entityId: string;
  metadata: any;
  createdAt: Date;
}
