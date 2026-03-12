import { Module } from '@nestjs/common';
import { ReviewController, ProviderReviewController } from './review.controller';
import { ReviewService } from './services/review.service';
import { ReviewRepository } from './repositories/review.repository';

@Module({
  controllers: [ReviewController, ProviderReviewController],
  providers: [ReviewService, ReviewRepository],
  exports: [ReviewService],
})
export class ReviewModule {}
