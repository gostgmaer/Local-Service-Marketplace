import { Injectable, Inject, LoggerService } from '@nestjs/common';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { ReviewRepository } from '../repositories/review.repository';
import { CreateReviewDto } from '../dto/create-review.dto';
import { Review } from '../entities/review.entity';
import { NotFoundException } from '../../common/exceptions/http.exceptions';

@Injectable()
export class ReviewService {
  constructor(
    private readonly reviewRepository: ReviewRepository,
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger: LoggerService,
  ) {}

  async createReview(createReviewDto: CreateReviewDto): Promise<Review> {
    this.logger.log(
      `Creating review for provider ${createReviewDto.providerId}`,
      'ReviewService',
    );

    const review = await this.reviewRepository.createReview(createReviewDto);

    this.logger.log(
      `Review created successfully with ID ${review.id}`,
      'ReviewService',
    );

    return review;
  }

  async getProviderReviews(
    providerId: string,
    limit: number = 20,
    offset: number = 0,
  ): Promise<{
    reviews: Review[];
    total: number;
    averageRating: number;
  }> {
    this.logger.log(
      `Fetching reviews for provider ${providerId} (limit: ${limit}, offset: ${offset})`,
      'ReviewService',
    );

    const reviews = await this.reviewRepository.getProviderReviews(
      providerId,
      limit,
      offset,
    );

    const ratingData = await this.reviewRepository.getProviderRating(
      providerId,
    );

    return {
      reviews,
      total: ratingData.totalReviews,
      averageRating: ratingData.averageRating,
    };
  }

  async getProviderRating(providerId: string): Promise<{
    averageRating: number;
    totalReviews: number;
  }> {
    this.logger.log(
      `Calculating rating for provider ${providerId}`,
      'ReviewService',
    );

    const ratingData = await this.reviewRepository.getProviderRating(
      providerId,
    );

    return ratingData;
  }

  async getReviewById(id: string): Promise<Review> {
    this.logger.log(`Fetching review with ID ${id}`, 'ReviewService');

    const review = await this.reviewRepository.getReviewById(id);

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    return review;
  }
}
