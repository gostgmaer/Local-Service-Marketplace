import { Injectable, Inject, LoggerService } from '@nestjs/common';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { RequestRepository } from '../repositories/request.repository';
import { CategoryRepository } from '../repositories/category.repository';
import { CreateRequestDto } from '../dto/create-request.dto';
import { UpdateRequestDto } from '../dto/update-request.dto';
import { RequestQueryDto } from '../dto/request-query.dto';
import { RequestResponseDto, PaginatedRequestResponseDto } from '../dto/request-response.dto';
import { NotFoundException, BadRequestException } from '../../../common/exceptions/http.exceptions';

@Injectable()
export class RequestService {
  constructor(
    private readonly requestRepository: RequestRepository,
    private readonly categoryRepository: CategoryRepository,
    @Inject(WINSTON_MODULE_NEST_PROVIDER) private readonly logger: LoggerService,
  ) {}

  async createRequest(dto: CreateRequestDto): Promise<RequestResponseDto> {
    this.logger.log(`Creating request for user ${dto.user_id}`, RequestService.name);

    // Validate category exists
    const categoryExists = await this.categoryRepository.categoryExists(dto.category_id);
    if (!categoryExists) {
      throw new NotFoundException('Category not found');
    }

    // Validate budget
    if (dto.budget < 0) {
      throw new BadRequestException('Budget must be a positive number');
    }

    const request = await this.requestRepository.createRequest(dto);

    this.logger.log(`Request created successfully: ${request.id}`, RequestService.name);

    return RequestResponseDto.fromEntity(request);
  }

  async getRequests(queryDto: RequestQueryDto): Promise<PaginatedRequestResponseDto> {
    this.logger.log(`Fetching requests with filters: ${JSON.stringify(queryDto)}`, RequestService.name);

    const limit = queryDto.limit || 20;
    const requests = await this.requestRepository.getRequestsPaginated(queryDto);

    const hasMore = requests.length > limit;
    const data = requests.slice(0, limit);
    const nextCursor = hasMore ? data[data.length - 1].id : undefined;

    const response = data.map(RequestResponseDto.fromEntity);

    return new PaginatedRequestResponseDto(response, nextCursor, hasMore);
  }

  async getRequestById(id: string): Promise<RequestResponseDto> {
    this.logger.log(`Fetching request: ${id}`, RequestService.name);

    const request = await this.requestRepository.getRequestById(id);

    if (!request) {
      throw new NotFoundException('Request not found');
    }

    return RequestResponseDto.fromEntity(request);
  }

  async updateRequest(id: string, dto: UpdateRequestDto): Promise<RequestResponseDto> {
    this.logger.log(`Updating request: ${id}`, RequestService.name);

    // Validate request exists
    const existingRequest = await this.requestRepository.getRequestById(id);
    if (!existingRequest) {
      throw new NotFoundException('Request not found');
    }

    // Validate category if provided
    if (dto.category_id) {
      const categoryExists = await this.categoryRepository.categoryExists(dto.category_id);
      if (!categoryExists) {
        throw new NotFoundException('Category not found');
      }
    }

    // Validate budget if provided
    if (dto.budget !== undefined && dto.budget < 0) {
      throw new BadRequestException('Budget must be a positive number');
    }

    const updatedRequest = await this.requestRepository.updateRequest(id, dto);

    this.logger.log(`Request updated successfully: ${id}`, RequestService.name);

    return RequestResponseDto.fromEntity(updatedRequest);
  }

  async deleteRequest(id: string): Promise<void> {
    this.logger.log(`Deleting request: ${id}`, RequestService.name);

    const request = await this.requestRepository.getRequestById(id);
    if (!request) {
      throw new NotFoundException('Request not found');
    }

    await this.requestRepository.deleteRequest(id);

    this.logger.log(`Request deleted successfully: ${id}`, RequestService.name);
  }

  async getRequestsByUser(userId: string): Promise<RequestResponseDto[]> {
    this.logger.log(`Fetching requests for user: ${userId}`, RequestService.name);

    const requests = await this.requestRepository.getRequestsByUser(userId);

    return requests.map(RequestResponseDto.fromEntity);
  }
}
