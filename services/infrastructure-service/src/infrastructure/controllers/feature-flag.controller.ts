import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Inject,
  LoggerService,
  HttpStatus,
} from '@nestjs/common';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { FeatureFlagService } from '../services/feature-flag.service';
import { CreateFeatureFlagDto } from '../dto/create-feature-flag.dto';
import { UpdateFeatureFlagDto } from '../dto/update-feature-flag.dto';

@Controller('feature-flags')
export class FeatureFlagController {
  constructor(
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger: LoggerService,
    private readonly featureFlagService: FeatureFlagService,
  ) {}

  @Post()
  async createFeatureFlag(@Body() createFlagDto: CreateFeatureFlagDto) {
    this.logger.log(
      `POST /feature-flags - Create feature flag: ${createFlagDto.key}`,
      'FeatureFlagController',
    );

    const flag = await this.featureFlagService.createFeatureFlag(createFlagDto);

    return {
      statusCode: HttpStatus.CREATED,
      message: 'Feature flag created successfully',
      data: flag,
    };
  }

  @Get()
  async getAllFeatureFlags() {
    this.logger.log(
      'GET /feature-flags - Retrieve all feature flags',
      'FeatureFlagController',
    );

    const data = await this.featureFlagService.getAllFeatureFlags();

    return {
      statusCode: HttpStatus.OK,
      message: 'Feature flags retrieved successfully',
      data,
    };
  }

  @Get(':key')
  async getFeatureFlagByKey(@Param('key') key: string) {
    this.logger.log(
      `GET /feature-flags/${key} - Retrieve feature flag by key`,
      'FeatureFlagController',
    );

    const flag = await this.featureFlagService.getFeatureFlagByKey(key);

    return {
      statusCode: HttpStatus.OK,
      message: 'Feature flag retrieved successfully',
      data: flag,
    };
  }

  @Get(':key/enabled')
  async isFeatureEnabled(
    @Param('key') key: string,
    @Query('userId') userId?: string,
  ) {
    this.logger.log(
      `GET /feature-flags/${key}/enabled - Check if feature is enabled`,
      'FeatureFlagController',
    );

    const enabled = await this.featureFlagService.isFeatureEnabled(key, userId);

    return {
      statusCode: HttpStatus.OK,
      message: 'Feature flag status retrieved successfully',
      data: { enabled },
    };
  }

  @Patch(':key')
  async updateFeatureFlag(
    @Param('key') key: string,
    @Body() updateFlagDto: UpdateFeatureFlagDto,
  ) {
    this.logger.log(
      `PATCH /feature-flags/${key} - Update feature flag`,
      'FeatureFlagController',
    );

    const flag = await this.featureFlagService.updateFeatureFlag(
      key,
      updateFlagDto,
    );

    return {
      statusCode: HttpStatus.OK,
      message: 'Feature flag updated successfully',
      data: flag,
    };
  }

  @Delete(':key')
  async deleteFeatureFlag(@Param('key') key: string) {
    this.logger.log(
      `DELETE /feature-flags/${key} - Delete feature flag`,
      'FeatureFlagController',
    );

    await this.featureFlagService.deleteFeatureFlag(key);

    return {
      statusCode: HttpStatus.OK,
      message: 'Feature flag deleted successfully',
    };
  }
}
