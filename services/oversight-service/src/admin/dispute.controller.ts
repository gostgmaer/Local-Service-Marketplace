import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Headers,
  UseGuards,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { FlexibleIdPipe } from "@/common/pipes/flexible-id.pipe";
import { JwtAuthGuard } from "@/common/guards/jwt-auth.guard";
import { DisputeService } from "./services/dispute.service";
import { CreateDisputeDto } from "./dto/create-dispute.dto";
import { UserDisputeQueryDto } from "./dto/user-dispute-query.dto";

/**
 * User-facing dispute endpoints.
 * Accessible by any authenticated user (customer or provider).
 *
 * Routes:
 *   POST   /disputes                      — File a new dispute
 *   GET    /disputes/my                   — Get current user's disputes
 *   GET    /disputes/:id                  — Get a single dispute (parties or admin)
 *   GET    /disputes/:id/messages         — Get messages for a dispute
 *   POST   /disputes/:id/messages         — Add a message to a dispute thread
 */
@UseGuards(JwtAuthGuard)
@Controller("disputes")
export class DisputeController {
  constructor(private readonly disputeService: DisputeService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createDispute(
    @Body() dto: CreateDisputeDto,
    @Headers("x-user-id") userId: string,
  ) {
    return this.disputeService.createDispute(
      dto.job_id,
      userId,
      dto.reason,
      dto.description,
      dto.evidence_images,
    );
  }

  @Get("my")
  async getMyDisputes(
    @Headers("x-user-id") userId: string,
    @Query() query: UserDisputeQueryDto,
  ) {
    return this.disputeService.getUserDisputes(userId, {
      status: query.status,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    });
  }

  @Get(":id/messages")
  async getDisputeMessages(
    @Param("id", FlexibleIdPipe) id: string,
    @Headers("x-user-id") userId: string,
  ) {
    return this.disputeService.getDisputeMessages(id, userId);
  }

  @Post(":id/messages")
  @HttpCode(HttpStatus.CREATED)
  async addDisputeMessage(
    @Param("id", FlexibleIdPipe) id: string,
    @Headers("x-user-id") userId: string,
    @Body() body: { message: string; images?: { id: string; url: string }[] },
  ) {
    return this.disputeService.addDisputeMessage(
      id,
      userId,
      body.message,
      body.images ?? [],
      false, // user-side messages are never admin
    );
  }

  @Get(":id")
  async getDisputeById(
    @Param("id", FlexibleIdPipe) id: string,
    @Headers("x-user-id") userId: string,
  ) {
    return this.disputeService.getDisputeForUser(id, userId);
  }
}
