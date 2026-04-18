import {
  Controller,
  Get,
  Param,
  Query,
  ParseFloatPipe,
  ParseIntPipe,
} from "@nestjs/common";
import { FlexibleIdPipe } from "@/common/pipes/flexible-id.pipe";
import { ProviderReviewAggregateService } from "../services/provider-review-aggregate.service";

@Controller("review-aggregates")
export class ProviderReviewAggregateController {
  constructor(
    private readonly aggregateService: ProviderReviewAggregateService,
  ) {}

  @Get("provider/:providerId")
  async getProviderAggregate(
    @Param("providerId", FlexibleIdPipe) providerId: string,
  ) {
    const aggregate =
      await this.aggregateService.getProviderAggregate(providerId);

    // Return data directly — ResponseTransformInterceptor handles envelope wrapping.
    // Returning { message, data } causes the interceptor to produce { data: { data: ... } }.
    if (!aggregate) return null;

    return {
      ...aggregate,
      one_star_count: aggregate.rating_1_count,
      two_star_count: aggregate.rating_2_count,
      three_star_count: aggregate.rating_3_count,
      four_star_count: aggregate.rating_4_count,
      five_star_count: aggregate.rating_5_count,
    };
  }

  @Get("provider/:providerId/distribution")
  async getRatingDistribution(
    @Param("providerId", FlexibleIdPipe) providerId: string,
  ) {
    return this.aggregateService.getRatingDistribution(providerId);
  }

  @Get("provider/:providerId/trust-badge")
  async checkTrustBadge(
    @Param("providerId", FlexibleIdPipe) providerId: string,
  ) {
    return this.aggregateService.checkTrustBadgeEligibility(providerId);
  }

  @Get("top-rated")
  async getTopRatedProviders(
    @Query("limit", new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    const providers = await this.aggregateService.getTopRatedProviders(
      limit || 10,
    );

    return providers.map((aggregate) => ({
      ...aggregate,
      one_star_count: aggregate.rating_1_count,
      two_star_count: aggregate.rating_2_count,
      three_star_count: aggregate.rating_3_count,
      four_star_count: aggregate.rating_4_count,
      five_star_count: aggregate.rating_5_count,
    }));
  }

  @Get("by-rating")
  async getProvidersByRating(
    @Query("min", ParseFloatPipe) minRating: number,
    @Query("max", ParseFloatPipe) maxRating: number,
    @Query("limit", new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    const providers = await this.aggregateService.getProvidersByRating(
      minRating,
      maxRating,
      limit || 20,
    );

    return providers.map((aggregate) => ({
      ...aggregate,
      one_star_count: aggregate.rating_1_count,
      two_star_count: aggregate.rating_2_count,
      three_star_count: aggregate.rating_3_count,
      four_star_count: aggregate.rating_4_count,
      five_star_count: aggregate.rating_5_count,
    }));
  }
}
