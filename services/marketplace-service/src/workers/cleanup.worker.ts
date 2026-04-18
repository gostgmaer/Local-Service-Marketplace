import { Processor, WorkerHost, OnWorkerEvent } from "@nestjs/bullmq";
import { Inject, LoggerService, OnModuleInit } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Job, Queue } from "bullmq";
import { WINSTON_MODULE_NEST_PROVIDER } from "nest-winston";
import { RequestRepository } from "../modules/request/repositories/request.repository";
import { JobRepository } from "../modules/job/repositories/job.repository";
import { DEFAULT_JOB_OPTIONS } from "../bullmq/bullmq-default-options";

@Processor("marketplace.cleanup", {
  concurrency: 1,
})
export class MarketplaceCleanupWorker
  extends WorkerHost
  implements OnModuleInit
{
  constructor(
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger: LoggerService,
    @InjectQueue("marketplace.cleanup") private readonly cleanupQueue: Queue,
    private readonly requestRepository: RequestRepository,
    private readonly jobRepository: JobRepository,
  ) {
    super();
  }

  async onModuleInit(): Promise<void> {
    // Daily 2 AM — expire stale open requests (days from system settings)
    await this.cleanupQueue.add(
      "expire-stale-requests",
      {},
      { ...DEFAULT_JOB_OPTIONS, repeat: { pattern: "0 2 * * *" } },
    );
    // Daily 3 AM — auto-complete in_progress jobs with no activity
    await this.cleanupQueue.add(
      "auto-complete-stale-jobs",
      {},
      { ...DEFAULT_JOB_OPTIONS, repeat: { pattern: "0 3 * * *" } },
    );
    this.logger.log(
      "Marketplace cleanup repeatable jobs registered",
      "MarketplaceCleanupWorker",
    );
  }

  async process(job: Job<any, any, string>): Promise<any> {
    try {
      switch (job.name) {
        case "expire-stale-requests":
          return this.handleExpireStaleRequests();
        case "auto-complete-stale-jobs":
          return this.handleAutoCompleteStaleJobs();
        default:
          throw new Error(`Unknown job name: ${job.name}`);
      }
    } catch (error: any) {
      const err = error as Error;
      this.logger.error(
        `Job "${job.name}/${job.id}" threw: ${err.message}`,
        err.stack,
        "MarketplaceCleanupWorker",
      );
      throw error;
    }
  }

  private async handleExpireStaleRequests(): Promise<void> {
    this.logger.log("Expiring stale open requests", "MarketplaceCleanupWorker");
    const expiryDays = parseInt(
      await this.requestRepository.getSystemSetting("request_expiry_days", "30"),
      10,
    );
    const cutoff = new Date(Date.now() - expiryDays * 24 * 60 * 60 * 1000);
    const count = await this.requestRepository.expireStaleRequests(cutoff);
    this.logger.log(
      `Expired ${count} stale requests (cutoff: ${expiryDays} days)`,
      "MarketplaceCleanupWorker",
    );
  }

  private async handleAutoCompleteStaleJobs(): Promise<void> {
    this.logger.log(
      "Auto-completing stale in_progress jobs",
      "MarketplaceCleanupWorker",
    );
    const autoCompleteDays = parseInt(
      await this.jobRepository.getSystemSetting("job_auto_complete_days", "7"),
      10,
    );
    const cutoff = new Date(
      Date.now() - autoCompleteDays * 24 * 60 * 60 * 1000,
    );
    const count = await this.jobRepository.autoCompleteStaleJobs(cutoff);
    this.logger.log(
      `Auto-completed ${count} stale jobs (cutoff: ${autoCompleteDays} days)`,
      "MarketplaceCleanupWorker",
    );
  }

  // ─────────────────────────────────────────────────────────────────
  // Worker lifecycle hooks
  // ─────────────────────────────────────────────────────────────────

  @OnWorkerEvent("active")
  onActive(job: Job): void {
    this.logger.log(
      `Job "${job.name}/${job.id}" started (attempt ${job.attemptsMade + 1})`,
      "MarketplaceCleanupWorker",
    );
  }

  @OnWorkerEvent("completed")
  onCompleted(job: Job): void {
    this.logger.log(
      `Job "${job.name}/${job.id}" completed`,
      "MarketplaceCleanupWorker",
    );
  }

  @OnWorkerEvent("failed")
  onFailed(job: Job | undefined, error: Error): void {
    this.logger.error(
      `Job "${job?.name ?? "unknown"}/${job?.id ?? "?"}" failed (attempt ${job?.attemptsMade ?? 0}): ${error.message}`,
      error.stack,
      "MarketplaceCleanupWorker",
    );
  }

  @OnWorkerEvent("error")
  onError(error: Error): void {
    this.logger.error(
      `Worker error: ${error.message}`,
      error.stack,
      "MarketplaceCleanupWorker",
    );
  }

  @OnWorkerEvent("stalled")
  onStalled(jobId: string): void {
    this.logger.warn(
      `Job ${jobId} stalled and will be requeued`,
      "MarketplaceCleanupWorker",
    );
  }
}
