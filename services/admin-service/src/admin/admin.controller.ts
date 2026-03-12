import {
  Controller,
  Get,
  Patch,
  Body,
  Param,
  Query,
  Headers,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { UserModerationService } from './services/user-moderation.service';
import { DisputeService } from './services/dispute.service';
import { AuditLogService } from './services/audit-log.service';
import { SystemSettingService } from './services/system-setting.service';
import { SuspendUserDto } from './dto/suspend-user.dto';
import { UpdateDisputeDto } from './dto/update-dispute.dto';
import { UpdateSystemSettingDto } from './dto/update-system-setting.dto';

@Controller('admin')
export class AdminController {
  constructor(
    private readonly userModerationService: UserModerationService,
    private readonly disputeService: DisputeService,
    private readonly auditLogService: AuditLogService,
    private readonly systemSettingService: SystemSettingService,
  ) {}

  // User Moderation Endpoints
  @Get('users')
  async getUsers(
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
    @Query('search') search?: string,
  ) {
    if (search) {
      return this.userModerationService.searchUsers(search);
    }
    return this.userModerationService.getAllUsers(limit, offset);
  }

  @Get('users/:id')
  async getUserById(@Param('id') id: string) {
    return this.userModerationService.getUserById(id);
  }

  @Patch('users/:id/suspend')
  async suspendUser(
    @Param('id') id: string,
    @Body() suspendUserDto: SuspendUserDto,
    @Headers('x-admin-id') adminId: string,
  ) {
    return this.userModerationService.suspendUser(
      id,
      adminId,
      suspendUserDto.suspended,
      suspendUserDto.reason,
    );
  }

  // Dispute Management Endpoints
  @Get('disputes')
  async getDisputes(
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
    @Query('status') status?: string,
  ) {
    if (status) {
      const disputes = await this.disputeService.getDisputesByStatus(status);
      return { disputes, total: disputes.length };
    }
    return this.disputeService.getAllDisputes(limit, offset);
  }

  @Get('disputes/:id')
  async getDisputeById(@Param('id') id: string) {
    return this.disputeService.getDisputeById(id);
  }

  @Patch('disputes/:id')
  async updateDispute(
    @Param('id') id: string,
    @Body() updateDisputeDto: UpdateDisputeDto,
    @Headers('x-admin-id') adminId: string,
  ) {
    return this.disputeService.updateDispute(
      id,
      adminId,
      updateDisputeDto.status,
      updateDisputeDto.resolution,
    );
  }

  // Audit Log Endpoints
  @Get('audit-logs')
  async getAuditLogs(
    @Query('limit', new DefaultValuePipe(100), ParseIntPipe) limit: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
    @Query('userId') userId?: string,
  ) {
    if (userId) {
      const logs = await this.auditLogService.getAuditLogsByUserId(userId);
      return { logs, total: logs.length };
    }
    return this.auditLogService.getAuditLogs(limit, offset);
  }

  @Get('audit-logs/entity/:entity/:entityId')
  async getAuditLogsByEntity(
    @Param('entity') entity: string,
    @Param('entityId') entityId: string,
  ) {
    return this.auditLogService.getAuditLogsByEntity(entity, entityId);
  }

  // System Settings Endpoints
  @Get('settings')
  async getSettings() {
    return this.systemSettingService.getAllSettings();
  }

  @Get('settings/:key')
  async getSettingByKey(@Param('key') key: string) {
    return this.systemSettingService.getSettingByKey(key);
  }

  @Patch('settings/:key')
  async updateSetting(
    @Param('key') key: string,
    @Body() updateSettingDto: UpdateSystemSettingDto,
    @Headers('x-admin-id') adminId: string,
  ) {
    return this.systemSettingService.updateSetting(
      key,
      updateSettingDto.value,
      adminId,
    );
  }
}
