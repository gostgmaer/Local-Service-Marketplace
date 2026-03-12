export class UserActivityLog {
  id: string;
  userId: string;
  action: string;
  metadata: any;
  ipAddress: string;
  createdAt: Date;
}
