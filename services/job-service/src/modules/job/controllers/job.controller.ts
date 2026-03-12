import { Controller, Post, Get, Patch, Body, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { JobService } from '../services/job.service';
import { CreateJobDto } from '../dto/create-job.dto';
import { UpdateJobStatusDto } from '../dto/update-job-status.dto';
import { JobResponseDto } from '../dto/job-response.dto';

@Controller('jobs')
export class JobController {
  constructor(private readonly jobService: JobService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createJob(@Body() createJobDto: CreateJobDto): Promise<JobResponseDto> {
    return this.jobService.createJob(createJobDto);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async getJobById(@Param('id') id: string): Promise<JobResponseDto> {
    return this.jobService.getJobById(id);
  }

  @Patch(':id/status')
  @HttpCode(HttpStatus.OK)
  async updateJobStatus(
    @Param('id') id: string,
    @Body() updateJobStatusDto: UpdateJobStatusDto,
  ): Promise<JobResponseDto> {
    return this.jobService.updateJobStatus(id, updateJobStatusDto);
  }

  @Post(':id/complete')
  @HttpCode(HttpStatus.OK)
  async completeJob(@Param('id') id: string): Promise<JobResponseDto> {
    return this.jobService.completeJob(id);
  }

  @Get('provider/:providerId')
  @HttpCode(HttpStatus.OK)
  async getJobsByProvider(@Param('providerId') providerId: string): Promise<JobResponseDto[]> {
    return this.jobService.getJobsByProvider(providerId);
  }

  @Get('status/:status')
  @HttpCode(HttpStatus.OK)
  async getJobsByStatus(@Param('status') status: string): Promise<JobResponseDto[]> {
    return this.jobService.getJobsByStatus(status);
  }
}
