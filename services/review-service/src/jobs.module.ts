import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ReviewAggregateRefreshJob } from './review/jobs/review-aggregate-refresh.job';
import { ProviderReviewAggregateRepository } from './review/repositories/provider-review-aggregate.repository';

@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [
    ReviewAggregateRefreshJob,
    ProviderReviewAggregateRepository
  ],
  exports: [ReviewAggregateRefreshJob]
})
export class JobsModule {}
