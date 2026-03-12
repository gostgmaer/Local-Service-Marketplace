export class NotificationDelivery {
  id: string;
  notificationId: string;
  channel: string;
  status: string;

  constructor(partial: Partial<NotificationDelivery>) {
    Object.assign(this, partial);
  }
}
