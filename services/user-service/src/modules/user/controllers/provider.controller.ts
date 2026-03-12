import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { ProviderService } from '../services/provider.service';
import { CreateProviderDto } from '../dto/create-provider.dto';
import { UpdateProviderDto } from '../dto/update-provider.dto';
import { ProviderQueryDto } from '../dto/provider-query.dto';
import { ProviderResponseDto } from '../dto/provider-response.dto';
import { PaginatedResponseDto } from '../dto/paginated-response.dto';

@Controller('providers')
export class ProviderController {
  constructor(
    private readonly providerService: ProviderService,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createProvider(
    @Body() createProviderDto: CreateProviderDto,
  ): Promise<ProviderResponseDto> {
    this.logger.info('POST /providers', {
      context: 'ProviderController',
      user_id: createProviderDto.user_id,
    });
    return this.providerService.createProvider(createProviderDto);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async getProvider(@Param('id') id: string): Promise<ProviderResponseDto> {
    this.logger.info('GET /providers/:id', {
      context: 'ProviderController',
      provider_id: id,
    });
    return this.providerService.getProvider(id);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  async getProviders(
    @Query() queryDto: ProviderQueryDto,
  ): Promise<PaginatedResponseDto<ProviderResponseDto>> {
    this.logger.info('GET /providers', {
      context: 'ProviderController',
      query: queryDto,
    });
    return this.providerService.getProviders(queryDto);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  async updateProvider(
    @Param('id') id: string,
    @Body() updateProviderDto: UpdateProviderDto,
  ): Promise<ProviderResponseDto> {
    this.logger.info('PATCH /providers/:id', {
      context: 'ProviderController',
      provider_id: id,
    });
    return this.providerService.updateProvider(id, updateProviderDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteProvider(@Param('id') id: string): Promise<void> {
    this.logger.info('DELETE /providers/:id', {
      context: 'ProviderController',
      provider_id: id,
    });
    return this.providerService.deleteProvider(id);
  }
}
