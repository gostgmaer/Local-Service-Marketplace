import { Injectable, Inject, LoggerService } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { WINSTON_MODULE_NEST_PROVIDER } from "nest-winston";
import { RequestRepository } from "../repositories/request.repository";
import { CategoryRepository } from "../repositories/category.repository";
import { LocationRepository } from "../repositories/location.repository";
import { CreateRequestDto } from "../dto/create-request.dto";
import { UpdateRequestDto } from "../dto/update-request.dto";
import {
  RequestQueryDto,
  RequestSortBy,
  SortOrder,
} from "../dto/request-query.dto";
import {
  RequestResponseDto,
  PaginatedRequestResponseDto,
} from "../dto/request-response.dto";
import {
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from "../../../common/exceptions/http.exceptions";
import {
  validateCursorMode,
  validateDateRange,
  validateMinMaxRange,
} from "../../../common/pagination/list-query-validation.util";
import { KafkaService } from "../../../kafka/kafka.service";
import { RedisService } from "../../../redis/redis.service";
import { NotificationClient } from "../../../common/notification/notification.client";
import { UserClient } from "../../../common/user/user.client";
import { CacheInvalidationService } from "../../../common/services/cache-invalidation.service";
import { BroadcastService } from "../../../common/services/broadcast.service";

@Injectable()
export class RequestService {
  private readonly workersEnabled = process.env.WORKERS_ENABLED === "true";

  constructor(
    private readonly requestRepository: RequestRepository,
    private readonly categoryRepository: CategoryRepository,
    private readonly locationRepository: LocationRepository,
    private readonly kafkaService: KafkaService,
    private readonly redisService: RedisService,
    private readonly notificationClient: NotificationClient,
    private readonly userClient: UserClient,
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger: LoggerService,
    @InjectQueue("marketplace.notification")
    private readonly notificationQueue: Queue,
    private readonly cacheInvalidation: CacheInvalidationService,
    private readonly broadcastService: BroadcastService,
  ) {}

  async createRequest(dto: CreateRequestDto): Promise<RequestResponseDto> {
    const userContext = dto.user_id ? `user ${dto.user_id}` : "anonymous user";
    this.logger.log(`Creating request for ${userContext}`, RequestService.name);

    // Validate category exists
    const categoryExists = await this.categoryRepository.categoryExists(
      dto.category_id,
    );
    if (!categoryExists) {
      throw new NotFoundException("Category not found");
    }

    // Validate budget
    if (dto.budget <= 0) {
      throw new BadRequestException("Budget must be a positive number");
    }

    // For anonymous users, validate guest_info is provided
    if (!dto.user_id && (!dto.guest_info || !dto.guest_info.email)) {
      throw new BadRequestException(
        "Guest contact information is required for anonymous requests",
      );
    }

    // Check if guest requests are enabled (only enforce for anonymous submissions)
    if (!dto.user_id) {
      const guestEnabled = await this.requestRepository.getSystemSetting(
        "guest_requests_enabled",
        "true",
      );
      if (guestEnabled === "false") {
        throw new BadRequestException(
          "Guest (unauthenticated) service requests are currently disabled. Please sign in to submit a request.",
        );
      }
    }

    // Verify authenticated user has verified contact (email or phone) before creating a request
    if (dto.user_id && this.userClient.isEnabled()) {
      const requestingUser = await this.userClient.getUserById(dto.user_id);
      if (requestingUser) {
        const contactVerified =
          requestingUser.email_verified || requestingUser.phone_verified;
        if (!contactVerified) {
          throw new ForbiddenException(
            "Please verify your email address or phone number before creating a service request.",
          );
        }
      }
    }

    // Enforce active request cap for authenticated customers
    if (dto.user_id) {
      const maxActiveStr = await this.requestRepository.getSystemSetting(
        "max_active_requests_per_customer",
        "10",
      );
      const maxActive = parseInt(maxActiveStr, 10) || 10;
      const activeCount =
        await this.requestRepository.countActiveRequestsByUser(dto.user_id);
      if (activeCount >= maxActive) {
        throw new BadRequestException(
          `You have reached the maximum number of open service requests (${maxActive}). Please close or complete existing requests before creating new ones.`,
        );
      }
    }

    // Create location if provided
    let location_id: string | undefined;
    if (dto.location) {
      this.logger.log("Creating location for request", RequestService.name);
      const location = await this.locationRepository.createLocation({
        user_id: dto.user_id, // Will be null for anonymous users
        latitude: dto.location.latitude,
        longitude: dto.location.longitude,
        address: dto.location.address,
        city: dto.location.city,
        state: dto.location.state,
        zip_code: dto.location.pincode,
        country: dto.location.country,
      });
      location_id = location.id;
    }

    const request = await this.requestRepository.createRequest({
      ...dto,
      location_id,
    } as any);

    this.logger.log(
      `Request created successfully: ${request.id}`,
      RequestService.name,
    );

    // Send notification (non-blocking) — queue if workers enabled, else inline
    if (dto.user_id) {
      if (this.workersEnabled) {
        this.notificationQueue
          .add("notify-request-created", {
            userId: request.user_id,
            requestId: request.id,
            description: dto.description,
            budget: request.budget,
          })
          .catch((err: any) => {
            this.logger.warn(
              `Failed to enqueue request creation notification: ${err.message}`,
              RequestService.name,
            );
          });
      } else {
        this.userClient
          .getUserEmail(request.user_id)
          .then((email) => {
            if (!email) return;
            this.notificationClient.sendEmail({
              to: email,
              template: "MARKETPLACE_NEW_REQUEST",
              variables: {
                providerName: email.split("@")[0],
                requestTitle:
                  dto.description?.substring(0, 80) || "Service Request",
                category: "General",
                budget: request.budget ? `₹${request.budget}` : "Not specified",
                customerName: email.split("@")[0],
                requestDisplayId: request.id,
                requestUrl: `${process.env.FRONTEND_URL || "http://localhost:3000"}/requests/${request.id}`,
              },
            });
          })
          .catch((err: any) => {
            this.logger.warn(
              `Failed to send request creation notification: ${err.message}`,
              RequestService.name,
            );
          });
      }
    } else if (dto.guest_info?.email) {
      if (this.workersEnabled) {
        this.notificationQueue
          .add("notify-request-created", {
            guestEmail: dto.guest_info.email,
            requestId: request.id,
            description: dto.description,
            budget: request.budget,
          })
          .catch((err: any) => {
            this.logger.warn(
              `Failed to enqueue guest request creation notification: ${err.message}`,
              RequestService.name,
            );
          });
      } else {
        this.notificationClient
          .sendEmail({
            to: dto.guest_info.email,
            template: "MARKETPLACE_NEW_REQUEST",
            variables: {
              providerName: dto.guest_info.email.split("@")[0],
              requestTitle:
                dto.description?.substring(0, 80) || "Service Request",
              category: "General",
              budget: request.budget ? `₹${request.budget}` : "Not specified",
              customerName: dto.guest_info.email.split("@")[0],
              requestDisplayId: request.id,
              requestUrl: `${process.env.FRONTEND_URL || "http://localhost:3000"}/requests/${request.id}`,
            },
          })
          .catch((err: any) => {
            this.logger.warn(
              `Failed to send guest request creation notification: ${err.message}`,
              RequestService.name,
            );
          });
      }
    }

    // Publish event to Kafka if enabled
    await this.kafkaService.publishEvent("request-events", {
      eventType: "request_created",
      eventId: `${request.id}-${Date.now()}`,
      timestamp: new Date().toISOString(),
      data: {
        requestId: request.id,
        userId: request.user_id || null,
        isAnonymous: !dto.user_id,
        categoryId: request.category_id,
        budget: request.budget,
        status: request.status,
      },
    });

    await this.cacheInvalidation.invalidateEntity("requests");
    this.broadcastService.emit("request", request.id, "created", [`user:${request.user_id}`, "admin"], { requestId: request.id }, request.user_id);

    return RequestResponseDto.fromEntity(request);
  }

  async getRequests(
    queryDto: RequestQueryDto,
    user?: any,
  ): Promise<PaginatedRequestResponseDto> {
    this.logger.log(
      `Fetching requests with filters: ${JSON.stringify(queryDto)} for user ${user?.userId} (${user?.role})`,
      RequestService.name,
    );

    // RBAC: Users without browse permission can ONLY see their own requests
    const isAuthenticated = user && user.userId && user.userId !== "anonymous";
    if (
      isAuthenticated &&
      !user.permissions?.includes("requests.browse") &&
      !user.permissions?.includes("requests.manage")
    ) {
      this.logger.log(
        `Enforcing own-requests-only filter for user ${user.userId}`,
        RequestService.name,
      );
      queryDto.user_id = user.userId;
    }

    // RBAC: Providers see open requests + requests they have a job on
    if (isAuthenticated && user.role === "provider") {
      this.logger.log(
        `Enforcing provider visibility filter for user ${user.userId}`,
        RequestService.name,
      );
      queryDto.provider_user_id = user.userId;
      // Remove any status filter the provider passed — the repo will handle the OR logic
      queryDto.status = undefined;
    }

    validateMinMaxRange(
      queryDto.min_budget,
      queryDto.max_budget,
      "min_budget",
      "max_budget",
    );
    validateDateRange(
      queryDto.created_from,
      queryDto.created_to,
      "created_from",
      "created_to",
    );
    validateCursorMode(
      queryDto.cursor,
      queryDto.page,
      queryDto.sortBy,
      queryDto.sortOrder,
      RequestSortBy.CREATED_AT,
      SortOrder.DESC,
    );

    const limitStr = await this.requestRepository.getSystemSetting(
      "default_page_limit",
      "20",
    );
    const limit = queryDto.limit || parseInt(limitStr, 10) || 20;

    if (queryDto.cursor) {
      const requests =
        await this.requestRepository.getRequestsPaginated(queryDto);
      const hasMore = requests.length > limit;
      const data = requests.slice(0, limit);
      const nextCursor = hasMore ? data[data.length - 1].id : undefined;
      const response = data.map(RequestResponseDto.fromEntity);
      return new PaginatedRequestResponseDto(
        response,
        nextCursor,
        hasMore,
        undefined,
        queryDto.page || 1,
        limit,
      );
    }

    const [requests, total] = await Promise.all([
      this.requestRepository.getRequestsPaginated(queryDto),
      this.requestRepository.countRequests(queryDto),
    ]);

    const response = requests.map(RequestResponseDto.fromEntity);
    return new PaginatedRequestResponseDto(
      response,
      undefined,
      false,
      total,
      queryDto.page || 1,
      limit,
    );
  }

  async getRequestById(id: string): Promise<RequestResponseDto> {
    this.logger.log(`Fetching request: ${id}`, RequestService.name);

    // Try cache first
    if (this.redisService.isCacheEnabled()) {
      const cacheKey = `request:${id}`;
      const cached = await this.redisService.get(cacheKey);

      if (cached) {
        const parsed = JSON.parse(cached);
        // Bust stale cache entries that are missing the category join (pre-fix cache)
        if (parsed.category_id && parsed.category === undefined) {
          await this.redisService.del(cacheKey);
        } else {
          this.logger.log(`Cache hit for request: ${id}`, RequestService.name);
          return parsed;
        }
      }
    }

    const request = await this.requestRepository.getRequestById(id);

    if (!request) {
      throw new NotFoundException("Request not found");
    }

    const response = RequestResponseDto.fromEntity(request);

    // Cache the result
    if (this.redisService.isCacheEnabled()) {
      const cacheKey = `request:${id}`;
      const cacheTtlStr = await this.requestRepository.getSystemSetting(
        "request_cache_ttl_seconds",
        "300",
      );
      const cacheTtl = parseInt(cacheTtlStr, 10) || 300;
      await this.redisService.set(cacheKey, JSON.stringify(response), cacheTtl);
    }

    return response;
  }

  async updateRequest(
    id: string,
    dto: UpdateRequestDto,
    userId: string,
  ): Promise<RequestResponseDto> {
    this.logger.log(`Updating request: ${id}`, RequestService.name);

    // Validate request exists
    const existingRequest = await this.requestRepository.getRequestById(id);
    if (!existingRequest) {
      throw new NotFoundException("Request not found");
    }

    // Ownership check — only the owner may update their request
    if (existingRequest.user_id !== userId) {
      throw new ForbiddenException(
        "You are not allowed to update this request",
      );
    }

    // Once a job has been created the request is locked — no edits or cancellations allowed
    if (existingRequest.status !== "open") {
      throw new BadRequestException(
        `Request cannot be edited because it is ${existingRequest.status}. Only open requests can be modified.`,
      );
    }
    // At this point status is guaranteed to be 'open'; the only permitted
    // customer-driven status change is open → cancelled.
    if (dto.status && !["cancelled"].includes(dto.status as string)) {
      throw new BadRequestException(
        `You can only cancel a request, not set it to '${dto.status}'.`,
      );
    }

    // Validate category if provided
    if (dto.category_id) {
      const categoryExists = await this.categoryRepository.categoryExists(
        dto.category_id,
      );
      if (!categoryExists) {
        throw new NotFoundException("Category not found");
      }
    }

    // Validate budget if provided
    if (dto.budget !== undefined && dto.budget < 0) {
      throw new BadRequestException("Budget must be a positive number");
    }

    const updatedRequest = await this.requestRepository.updateRequest(
      existingRequest.id,
      dto,
    );

    this.logger.log(`Request updated successfully: ${id}`, RequestService.name);

    // Send notification to user about update
    const userEmail = await this.userClient.getUserEmail(
      updatedRequest.user_id,
    );
    if (userEmail && dto.status) {
      const updatePayload = {
        to: userEmail,
        template: "MESSAGE_RECEIVED",
        variables: {
          recipientName: userEmail.split("@")[0],
          senderName: "LocalServices",
          messagePreview: `Your service request has been updated. Status: ${dto.status}`,
          receivedAt: new Date().toISOString(),
          replyUrl: `${process.env.FRONTEND_URL || "http://localhost:3000"}/requests/${id}`,
        },
      };
      if (this.workersEnabled) {
        this.notificationQueue
          .add("notify-request-updated", updatePayload)
          .catch((err: any) => {
            this.logger.warn(
              `Failed to enqueue request update notification: ${err.message}`,
              RequestService.name,
            );
          });
      } else {
        this.notificationClient.sendEmail(updatePayload).catch((err: any) => {
          this.logger.warn(
            `Failed to send request update notification: ${err.message}`,
            RequestService.name,
          );
        });
      }
    }

    // Invalidate cache
    if (this.redisService.isCacheEnabled()) {
      await this.redisService.del(`request:${existingRequest.id}`);
    }

    // Publish event to Kafka if enabled
    await this.kafkaService.publishEvent("request-events", {
      eventType: "request_updated",
      eventId: `${updatedRequest.id}-${Date.now()}`,
      timestamp: new Date().toISOString(),
      data: {
        requestId: updatedRequest.id,
        userId: updatedRequest.user_id,
        status: updatedRequest.status,
        changes: dto,
      },
    });

    await this.cacheInvalidation.invalidateEntity("requests");
    this.broadcastService.emit("request", updatedRequest.id, "updated", [`user:${updatedRequest.user_id}`, "admin"], { requestId: updatedRequest.id }, updatedRequest.user_id);

    return RequestResponseDto.fromEntity(updatedRequest);
  }

  async cancelRequest(id: string, userId: string): Promise<void> {
    this.logger.log(`Cancelling request: ${id}`, RequestService.name);

    const request = await this.requestRepository.getRequestById(id);
    if (!request) {
      throw new NotFoundException("Request not found");
    }

    if (request.user_id !== userId) {
      throw new ForbiddenException(
        "You are not allowed to cancel this request",
      );
    }

    if (request.status !== "open") {
      throw new BadRequestException(
        `Cannot cancel request with status '${request.status}'. Only open requests can be cancelled.`,
      );
    }

    await this.requestRepository.updateRequest(request.id, {
      status: "cancelled",
    } as any);

    this.logger.log(`Request cancelled: ${id}`, RequestService.name);

    // Notify customer of cancellation — queue if workers enabled, else inline
    if (this.workersEnabled) {
      this.notificationQueue
        .add("notify-request-cancelled", {
          userId: request.user_id,
          requestId: request.id,
        })
        .catch((err: any) => {
          this.logger.warn(
            `Failed to enqueue request cancellation notification: ${err.message}`,
            RequestService.name,
          );
        });
    } else {
      this.userClient
        .getUserEmail(request.user_id)
        .then((email) => {
          if (!email) return;
          this.notificationClient.sendEmail({
            to: email,
            template: "ORDER_CANCELLED",
            variables: {
              username: email.split("@")[0],
              orderId: request.id,
              cancelledBy: "user",
              reason: "Request cancelled",
            },
          });
        })
        .catch((err: any) => {
          this.logger.warn(
            `Failed to send request cancellation email: ${err.message}`,
            RequestService.name,
          );
        });
    }

    await this.kafkaService.publishEvent("request-events", {
      eventType: "request_cancelled",
      eventId: `${request.id}-${Date.now()}`,
      timestamp: new Date().toISOString(),
      data: {
        requestId: request.id,
        userId: request.user_id,
        status: "cancelled",
      },
    });

    await this.cacheInvalidation.invalidateEntity("requests");
    this.broadcastService.emit("request", request.id, "updated", [`user:${request.user_id}`, "admin"], { requestId: request.id }, request.user_id);
  }

  async deleteRequest(id: string): Promise<void> {
    this.logger.log(`Deleting request: ${id}`, RequestService.name);

    const request = await this.requestRepository.getRequestById(id);
    if (!request) {
      throw new NotFoundException("Request not found");
    }

    await this.requestRepository.deleteRequest(request.id);

    await this.cacheInvalidation.invalidateEntity("requests");
    this.broadcastService.emit("request", request.id, "deleted", [`user:${request.user_id}`, "admin"], { requestId: request.id }, request.user_id);

    this.logger.log(`Request deleted successfully: ${id}`, RequestService.name);
  }

  async getRequestsByUser(
    userId: string,
    limit = 20,
    page = 1,
  ): Promise<{ data: RequestResponseDto[]; total: number }> {
    this.logger.log(
      `Fetching requests for user: ${userId}`,
      RequestService.name,
    );

    const { rows, total } = await this.requestRepository.getRequestsByUser(
      userId,
      limit,
      page,
    );
    const data = rows.map(RequestResponseDto.fromEntity);

    return { data, total };
  }

  async getRequestStats(): Promise<{
    total: number;
    byStatus: {
      open: number;
      assigned: number;
      completed: number;
      cancelled: number;
    };
  }> {
    this.logger.log(`Fetching request stats`, RequestService.name);
    return this.requestRepository.getRequestStats();
  }

  async searchRequests(query: {
    q: string;
    category?: string;
    location?: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: any[]; total: number }> {
    this.logger.log(
      `Full-text search: q="${query.q}" category=${query.category} location=${query.location}`,
      RequestService.name,
    );
    return this.requestRepository.fullTextSearch(query.q, {
      category: query.category,
      location: query.location,
      page: query.page,
      limit: query.limit,
    });
  }
}
