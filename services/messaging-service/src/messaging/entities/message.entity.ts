export class Message {
  id: string;
  jobId: string;
  senderId: string;
  message: string;
  createdAt: Date;

  constructor(partial: Partial<Message>) {
    Object.assign(this, partial);
  }
}
