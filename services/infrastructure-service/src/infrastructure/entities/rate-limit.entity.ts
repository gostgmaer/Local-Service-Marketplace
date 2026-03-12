export class RateLimit {
  id: string;
  key: string;
  requestCount: number;
  windowStart: Date;
}
