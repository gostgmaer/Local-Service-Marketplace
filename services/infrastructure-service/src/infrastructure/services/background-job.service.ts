import { Injectable, Inject, LoggerService } from '@nestjs/common';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { BackgroundJobRepository } from '../repositories/background-job.repository';
import { RedisService } from '../../redis/redis.service';
import { CreateBackgroundJobDto } from '../dto/create-background-job.dto';
import { BackgroundJob } from '../entities/background-job.entity';

@Injectable()
export class BackgroundJobService {
  constructor(
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger: LoggerService,
    private readonly backgroundJobRepository: BackgroundJobRepository,
    private readonly redisService: RedisService,
  ) {}

  async createJob(createJobDto: CreateBackgroundJobDto): Promise<BackgroundJob> {
    try {
      // Create job in database
      const job = await this.backgroundJobRepository.createJob(createJobDto);

      // Add job to Redis queue
      await this.redisService.addJob(
        'background-jobs',
        createJobDto.jobType,
        {
          jobId: job.id,
          ...createJobDto.payload,
        },
        {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
        },
      );

      this.logger.log(
        `Background job created: ${createJobDto.jobType} (ID: ${job.id})`,
        'BackgroundJobService',
      );

      return job;
    } catch (error) {
      this.logger.error(
        `Failed to create background job: ${error.message}`,
        error.stack,
        'BackgroundJobService',
      );
      throw error;
    }
  }

  async getJobById(id: string): Promise<BackgroundJob | null> {
    try {
      const job = await this.backgroundJobRepository.getJobById(id);

      this.logger.log(
        `Retrieved background job by ID: ${id}`,
        'BackgroundJobService',
      );

      return job;
    } catch (error) {
      this.logger.error(
        `Failed to get background job: ${error.message}`,
        error.stack,
        'BackgroundJobService',
      );
      throw error;
    }
  }

  async getAllJobs(
    limit: number = 100,
    offset: number = 0,
  ): Promise<{ data: BackgroundJob[]; total: number }> {
    try {
      const [data, total] = await Promise.all([
        this.backgroundJobRepository.getAllJobs(limit, offset),
        this.backgroundJobRepository.getJobsCount(),
      ]);

      this.logger.log(
        `Retrieved ${data.length} background jobs`,
        'BackgroundJobService',
      );

      return { data, total };
    } catch (error) {
      this.logger.error(
        `Failed to get all jobs: ${error.message}`,
        error.stack,
        'BackgroundJobService',
      );
      throw error;
    }
  }

  async getJobsByStatus(status: string): Promise<BackgroundJob[]> {
    try {
      const jobs = await this.backgroundJobRepository.getJobsByStatus(status);

      this.logger.log(
        `Retrieved ${jobs.length} jobs with status: ${status}`,
        'BackgroundJobService',
      );

      return jobs;
    } catch (error) {
      this.logger.error(
        `Failed to get jobs by status: ${error.message}`,
        error.stack,
        'BackgroundJobService',
      );
      throw error;
    }
  }

  async updateJobStatus(id: string, status: string): Promise<BackgroundJob | null> {
    try {
      const job = await this.backgroundJobRepository.updateJobStatus(id, status);

      this.logger.log(
        `Updated job ${id} status to: ${status}`,
        'BackgroundJobService',
      );

      return job;
    } catch (error) {
      this.logger.error(
        `Failed to update job status: ${error.message}`,
        error.stack,
        'BackgroundJobService',
      );
      throw error;
    }
  }

  async incrementJobAttempts(id: string): Promise<BackgroundJob | null> {
    try {
      const job = await this.backgroundJobRepository.incrementJobAttempts(id);

      this.logger.log(
        `Incremented attempts for job: ${id}`,
        'BackgroundJobService',
      );

      return job;
    } catch (error) {
      this.logger.error(
        `Failed to increment job attempts: ${error.message}`,
        error.stack,
        'BackgroundJobService',
      );
      throw error;
    }
  }

  async deleteJob(id: string): Promise<void> {
    try {
      await this.backgroundJobRepository.deleteJob(id);

      this.logger.log(
        `Deleted background job: ${id}`,
        'BackgroundJobService',
      );
    } catch (error) {
      this.logger.error(
        `Failed to delete job: ${error.message}`,
        error.stack,
        'BackgroundJobService',
      );
      throw error;
    }
  }

  async getQueueStats(): Promise<any> {
    try {
      const counts = await this.redisService.getJobCounts('background-jobs');

      this.logger.log(
        'Retrieved queue statistics',
        'BackgroundJobService',
      );

      return counts;
    } catch (error) {
      this.logger.error(
        `Failed to get queue stats: ${error.message}`,
        error.stack,
        'BackgroundJobService',
      );
      throw error;
    }
  }
}
