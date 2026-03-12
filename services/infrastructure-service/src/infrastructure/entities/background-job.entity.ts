export class BackgroundJob {
  id: string;
  jobType: string;
  payload: any;
  status: string;
  attempts: number;
}
