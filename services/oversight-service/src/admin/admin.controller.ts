import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Body,
  Param,
  Query,
  Headers,
  ParseUUIDPipe,
  Ip,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { FlexibleIdPipe } from "@/common/pipes/flexible-id.pipe";
import { StrictUuidPipe } from "@/common/pipes/strict-uuid.pipe";
import { Request } from "express";
import { DisputeService } from "./services/dispute.service";
import { AuditLogService } from "./services/audit-log.service";
import { SystemSettingService } from "./services/system-setting.service";
import { ContactMessageService } from "./services/contact-message.service";
import { UpdateDisputeDto } from "./dto/update-dispute.dto";
import { UpdateSystemSettingDto } from "./dto/update-system-setting.dto";
import { CreateSystemSettingDto } from "./dto/create-system-setting.dto";
import { CreateContactMessageDto } from "./dto/create-contact-message.dto";
import { UpdateContactMessageDto } from "./dto/update-contact-message.dto";
import { DisputeListQueryDto } from "./dto/dispute-list-query.dto";
import { AuditLogQueryDto } from "./dto/audit-log-query.dto";
import { ContactMessageListQueryDto } from "./dto/contact-message-list-query.dto";
import { JwtAuthGuard } from "@/common/guards/jwt-auth.guard";
import {
  PermissionsGuard as RolesGuard,
  Roles,
  RequirePermissions,
} from "@/common/rbac";

@Controller("admin")
export class AdminController {
  constructor(
    private readonly disputeService: DisputeService,
    private readonly auditLogService: AuditLogService,
    private readonly systemSettingService: SystemSettingService,
    private readonly contactMessageService: ContactMessageService,
  ) {}

  // ── Dispute Management Endpoints (admin only) ──────────
  @RequirePermissions("disputes.view_stats")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get("disputes/stats")
  async getDisputeStats() {
    return this.disputeService.getDisputeStats();
  }

  @RequirePermissions("disputes.read")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get("disputes")
  async getDisputes(@Query() queryDto: DisputeListQueryDto) {
    return this.disputeService.getAllDisputes(queryDto);
  }

  @RequirePermissions("disputes.read")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get("disputes/:id")
  async getDisputeById(@Param("id", FlexibleIdPipe) id: string) {
    return this.disputeService.getDisputeById(id);
  }

  @RequirePermissions("disputes.manage")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Patch("disputes/:id")
  async updateDispute(
    @Param("id", StrictUuidPipe) id: string,
    @Body() updateDisputeDto: UpdateDisputeDto,
    @Headers("x-user-id") adminId: string,
  ) {
    return this.disputeService.updateDispute(
      id,
      adminId,
      updateDisputeDto.status,
      updateDisputeDto.resolution,
    );
  }

  @RequirePermissions("disputes.read")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get("disputes/:id/messages")
  async getDisputeMessages(
    @Param("id", FlexibleIdPipe) id: string,
    @Headers("x-user-id") adminId: string,
  ) {
    return this.disputeService.getDisputeMessages(id, adminId);
  }

  @RequirePermissions("disputes.manage")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post("disputes/:id/messages")
  @HttpCode(HttpStatus.CREATED)
  async addAdminDisputeMessage(
    @Param("id", FlexibleIdPipe) id: string,
    @Headers("x-user-id") adminId: string,
    @Body() body: { message: string; images?: { id: string; url: string }[] },
  ) {
    return this.disputeService.addDisputeMessage(
      id,
      adminId,
      body.message,
      body.images ?? [],
      true, // admin message
    );
  }

  // Audit Log Endpoints
  @RequirePermissions("audit.view")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get("audit-logs")
  async getAuditLogs(@Query() queryDto: AuditLogQueryDto) {
    return this.auditLogService.getAuditLogs(queryDto);
  }

  @RequirePermissions("audit.view")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get("audit-logs/entity/:entity/:entityId")
  async getAuditLogsByEntity(
    @Param("entity") entity: string,
    @Param("entityId", ParseUUIDPipe) entityId: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ) {
    const parsedPage = Math.max(1, parseInt(page ?? "1", 10) || 1);
    const parsedLimit = Math.min(
      100,
      Math.max(1, parseInt(limit ?? "20", 10) || 20),
    );
    return this.auditLogService.getAuditLogsByEntity(
      entity,
      entityId,
      parsedLimit,
      parsedPage,
    );
  }

  // System Settings Endpoints
  @RequirePermissions("settings.manage")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get("settings")
  async getSettings() {
    return this.systemSettingService.getAllSettings();
  }

  @RequirePermissions("settings.manage")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get("settings/:key")
  async getSettingByKey(@Param("key") key: string) {
    return this.systemSettingService.getSettingByKey(key);
  }

  @RequirePermissions("settings.manage")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Patch("settings/:key")
  async updateSetting(
    @Param("key") key: string,
    @Body() updateSettingDto: UpdateSystemSettingDto,
    @Headers("x-user-id") adminId: string,
  ) {
    return this.systemSettingService.updateSetting(
      key,
      updateSettingDto.value,
      adminId,
    );
  }

  @RequirePermissions("settings.manage")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post("settings")
  @HttpCode(HttpStatus.CREATED)
  async createSetting(
    @Body() createSettingDto: CreateSystemSettingDto,
    @Headers("x-user-id") adminId: string,
  ) {
    return this.systemSettingService.createSetting(createSettingDto, adminId);
  }

  // Contact Message Endpoints
  @Post("contact")
  @HttpCode(HttpStatus.CREATED)
  async createContactMessage(
    @Body() createContactMessageDto: CreateContactMessageDto,
    @Ip() ip: string,
    @Req() req: Request,
  ) {
    // Add IP address and user agent to the DTO
    createContactMessageDto.ip_address = ip;
    createContactMessageDto.user_agent = req.get("user-agent");

    return this.contactMessageService.createContactMessage(
      createContactMessageDto,
    );
  }

  @RequirePermissions("admin.contact_view")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get("contact")
  async getContactMessages(@Query() queryDto: ContactMessageListQueryDto) {
    return this.contactMessageService.getAllContactMessages(queryDto);
  }

  @RequirePermissions("admin.contact_view")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get("contact/email/:email")
  async getContactMessagesByEmail(
    @Param("email") email: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ) {
    const parsedPage = Math.max(1, parseInt(page ?? "1", 10) || 1);
    const parsedLimit = Math.min(
      100,
      Math.max(1, parseInt(limit ?? "20", 10) || 20),
    );
    return this.contactMessageService.getContactMessagesByEmail(
      email,
      parsedLimit,
      parsedPage,
    );
  }

  @RequirePermissions("admin.contact_view")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get("contact/user/:userId")
  async getContactMessagesByUserId(
    @Param("userId", FlexibleIdPipe) userId: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ) {
    const parsedPage = Math.max(1, parseInt(page ?? "1", 10) || 1);
    const parsedLimit = Math.min(
      100,
      Math.max(1, parseInt(limit ?? "20", 10) || 20),
    );
    return this.contactMessageService.getContactMessagesByUserId(
      userId,
      parsedLimit,
      parsedPage,
    );
  }

  @RequirePermissions("admin.contact_view")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get("contact/:id")
  async getContactMessageById(@Param("id", ParseUUIDPipe) id: string) {
    return this.contactMessageService.getContactMessageById(id);
  }

  @RequirePermissions("admin.contact_view")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Patch("contact/:id")
  @HttpCode(HttpStatus.OK)
  async updateContactMessage(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() updateContactMessageDto: UpdateContactMessageDto,
    @Headers("x-user-id") adminId: string,
  ) {
    return this.contactMessageService.updateContactMessage(
      id,
      updateContactMessageDto,
      adminId,
    );
  }

  @RequirePermissions("admin.contact_view")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Delete("contact/:id")
  @HttpCode(HttpStatus.OK)
  async deleteContactMessage(
    @Param("id", ParseUUIDPipe) id: string,
    @Headers("x-user-id") adminId: string,
  ) {
    return this.contactMessageService.deleteContactMessage(id, adminId);
  }
}
