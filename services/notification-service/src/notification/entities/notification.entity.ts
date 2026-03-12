export class Notification {
  id: string;
  userId: string;
  type: string;
  message: string;
  read: boolean;
  createdAt: Date;

  constructor(partial: Partial<Notification>) {
    Object.assign(this, partial);
  }
}
