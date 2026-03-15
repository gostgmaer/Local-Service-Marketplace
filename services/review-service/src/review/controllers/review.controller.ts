import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  Request,
  ParseUUIDPipe,
  UseGuards,
  HttpCode,
  HttpStatus
} from '@nestjs/common';
import { ReviewService } from '../services/review.service';
import { CreateReviewDto } from '../dto/create-review.dto';
import { RespondReviewDto } from '../dto/respond-review.dto';
import { MarkHelpfulDto } from '../dto/mark-helpful.dto';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { ReviewRepository } from '../repositories/review.repository';

@Controller('reviews')
export class ReviewController {
  constructor(
    private readonly reviewService: ReviewService,
    private readonly reviewRepository: ReviewRepository,
  ) {}

  /**
   * Create a review after job completion
   * POST /reviews
   */
  @Post()
  @UseGuards(JwtAuthGuard)
  async createReview(
    @Body() createReviewDto: CreateReviewDto,
    @Request() req: any
  ) {
    const review = await this.reviewService.createReview(createReviewDto);

    return {
      success: true,
      data: review,
      message: 'Review submitted successfully'
    };
  }

  /**
   * Get review by ID
   * GET /reviews/:id
   */
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async getReviewById(@Param('id', ParseUUIDPipe) id: string) {
    const review = await this.reviewService.getReviewById(id);
    
    return {
      success: true,
      data: review
    };
  }

  /**
   * Get reviews for a provider
   * GET /providers/:providerId/reviews
   */
  @Get('providers/:providerId/reviews')
  async getProviderReviews(
    @Param('providerId', ParseUUIDPipe) providerId: string,
    @Query('limit') limit: number = 20,
    @Query('offset') offset: number = 0
  ) {
    const result = await this.reviewService.getProviderReviews(
      providerId,
      Number(limit),
      Number(offset)
    );

    return {
      success: true,
      data: result.reviews,
      total: result.total,
      averageRating: result.averageRating
    };
  }

  /**
   * Get review for a specific job
   * GET /jobs/:jobId/review
   */
  @Get('jobs/:jobId/review')
  @UseGuards(JwtAuthGuard)
  async getJobReview(@Param('jobId', ParseUUIDPipe) jobId: string) {
    const review = await this.reviewRepository.getReviewByJobId(jobId);
    
    if (!review) {
      return {
        success: true,
        data: null,
        message: 'No review found for this job'
      };
    }

    return {
      success: true,
      data: review
    };
  }

  /**
   * Provider responds to a review
   * POST /reviews/:id/respond
   */
  @Post(':id/respond')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async respondToReview(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() respondReviewDto: RespondReviewDto,
    @Request() req: any
  ) {
    const review = await this.reviewRepository.respondToReview(
      id,
      respondReviewDto.response,
      req.user.id
    );

    return {
      success: true,
      data: review,
      message: 'Response added successfully'
    };
  }

  /**
   * Mark review as helpful
   * POST /reviews/:id/helpful
   */
  @Post(':id/helpful')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async markHelpful(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: any
  ) {
    const review = await this.reviewRepository.incrementHelpfulCount(id);

    return {
      success: true,
      data: review,
      message: 'Marked as helpful'
    };
  }
}
