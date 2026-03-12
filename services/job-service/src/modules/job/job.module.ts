import { Module } from '@nestjs/common';
import { JobController } from './controllers/job.controller';
import { JobService } from './services/job.service';
import { JobRepository } from './repositories/job.repository';
import { DatabaseModule } from '../../common/database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [JobController],
  providers: [JobService, JobRepository],
  exports: [JobService],
})
export class JobModule {}
