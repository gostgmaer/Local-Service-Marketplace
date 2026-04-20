import { Injectable, Inject, LoggerService } from "@nestjs/common";
import { WINSTON_MODULE_NEST_PROVIDER } from "nest-winston";
import { SystemSettingRepository } from "../repositories/system-setting.repository";
import { AuditLogRepository } from "../repositories/audit-log.repository";
import { SystemSetting } from "../entities/system-setting.entity";
import {
  NotFoundException,
  ConflictException,
  BadRequestException,
} from "../../common/exceptions/http.exceptions";
import { SystemSettingQueryDto } from "../dto/system-setting-query.dto";
import { resolvePagination } from "../../common/pagination/list-query-validation.util";
import { CreateSystemSettingDto } from "../dto/create-system-setting.dto";
import { CacheInvalidationService } from "../../common/services/cache-invalidation.service";
import { BroadcastService } from "../../common/services/broadcast.service";

@Injectable()
export class SystemSettingService {
  constructor(
    private readonly systemSettingRepository: SystemSettingRepository,
    private readonly auditLogRepository: AuditLogRepository,
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger: LoggerService,
    private readonly cacheInvalidation: CacheInvalidationService,
    private readonly broadcastService: BroadcastService,
  ) {}

  async getAllSettings(
    queryDto: SystemSettingQueryDto,
  ): Promise<{
    data: SystemSetting[];
    total: number;
    page: number;
    limit: number;
  }> {
    const pagination = resolvePagination(queryDto, { page: 1, limit: 50 });
    this.logger.log(
      `Fetching system settings (page: ${pagination.page}, limit: ${pagination.limit}, offset: ${pagination.offset})`,
      "SystemSettingService",
    );

    const [data, total] = await Promise.all([
      this.systemSettingRepository.findSettings(queryDto, pagination),
      this.systemSettingRepository.countSettings(queryDto),
    ]);

    return { data, total, page: pagination.page, limit: pagination.limit };
  }

  async getSettingByKey(key: string): Promise<SystemSetting> {
    this.logger.log(
      `Fetching system setting with key: ${key}`,
      "SystemSettingService",
    );

    const setting = await this.systemSettingRepository.getSettingByKey(key);

    if (!setting) {
      throw new NotFoundException("System setting not found");
    }

    return setting;
  }

  async updateSetting(
    key: string,
    value: string,
    adminId: string,
  ): Promise<SystemSetting> {
    this.logger.log(
      `Updating system setting ${key} to ${value} by admin ${adminId}`,
      "SystemSettingService",
    );

    // Check if setting exists
    const existingSetting =
      await this.systemSettingRepository.getSettingByKey(key);

    if (!existingSetting) {
      throw new NotFoundException("System setting not found");
    }

    // Validate value against the setting's declared type
    const settingType = existingSetting.type;
    if (settingType === "boolean") {
      if (value !== "true" && value !== "false") {
        throw new BadRequestException(
          `Setting '${key}' expects a boolean value ("true" or "false")`,
        );
      }
    } else if (settingType === "integer") {
      if (!/^-?\d+$/.test(value)) {
        throw new BadRequestException(
          `Setting '${key}' expects an integer value`,
        );
      }
    } else if (settingType === "json") {
      try {
        JSON.parse(value);
      } catch {
        throw new BadRequestException(
          `Setting '${key}' expects a valid JSON value`,
        );
      }
    }
    // "string" type accepts any non-empty string (already validated by DTO)

    // Update setting
    const updatedSetting = await this.systemSettingRepository.updateSetting(
      key,
      value,
    );

    // Create audit log
    await this.auditLogRepository.createAuditLog(
      adminId,
      "update_system_setting",
      "system_setting",
      key,
      {
        oldValue: existingSetting.value,
        newValue: value,
      },
    );

    this.logger.log(
      `System setting ${key} updated successfully`,
      "SystemSettingService",
    );

    await this.cacheInvalidation.invalidateEntity("settings");
    this.broadcastService.emit("setting", key, "updated", ["admin"], { key, value }, adminId);

    // If cache was disabled, flush all service caches
    if (key === "get_cache_enabled" && value === "false") {
      this.flushAllServiceCaches().catch((err) => {
        this.logger.warn(`Failed to flush service caches: ${err.message}`, "SystemSettingService");
      });
    }

    return updatedSetting;
  }

  async createSetting(
    dto: CreateSystemSettingDto,
    adminId: string,
  ): Promise<SystemSetting> {
    this.logger.log(
      `Creating system setting ${dto.key} by admin ${adminId}`,
      "SystemSettingService",
    );

    const existing = await this.systemSettingRepository.getSettingByKey(
      dto.key,
    );
    if (existing) {
      throw new ConflictException(
        `System setting with key '${dto.key}' already exists`,
      );
    }

    const newSetting = await this.systemSettingRepository.createSetting(
      dto.key,
      dto.value,
      dto.description,
      dto.type,
    );

    await this.auditLogRepository.createAuditLog(
      adminId,
      "create_system_setting",
      "system_setting",
      dto.key,
      {
        value: dto.value,
        description: dto.description,
      },
    );

    await this.cacheInvalidation.invalidateEntity("settings");
    this.broadcastService.emit("setting", dto.key, "created", ["admin"], { key: dto.key, value: dto.value }, adminId);

    this.logger.log(
      `System setting ${dto.key} created successfully`,
      "SystemSettingService",
    );

    return newSetting;
  }

  private async flushAllServiceCaches(): Promise<void> {
    const services = [
      { url: process.env.IDENTITY_SERVICE_URL || "http://localhost:3001" },
      { url: process.env.MARKETPLACE_SERVICE_URL || "http://localhost:3003" },
      { url: process.env.PAYMENT_SERVICE_URL || "http://localhost:3006" },
      { url: process.env.COMMS_SERVICE_URL || "http://localhost:3007" },
      { url: process.env.INFRASTRUCTURE_SERVICE_URL || "http://localhost:3012" },
    ];

    const secret = process.env.INTERNAL_SERVICE_SECRET;
    if (!secret) return;

    await Promise.allSettled(
      services.map((svc) =>
        fetch(`${svc.url}/cache/flush-all`, {
          method: "POST",
          headers: { "x-internal-secret": secret, "Content-Type": "application/json" },
        }),
      ),
    );

    // Also flush own cache
    await this.cacheInvalidation.invalidateAll();
  }
}
