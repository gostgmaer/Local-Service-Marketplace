import {
  Controller,
  Get,
  Put,
  Body,
  Request,
  ParseUUIDPipe,
  BadRequestException,
  UseGuards,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { NotificationPreferencesService } from "../services/notification-preferences.service";
import { FeatureFlagService } from "../services/feature-flag.service";
import { UpdateNotificationPreferencesDto } from "../dto/update-notification-preferences.dto";
import { JwtAuthGuard } from "@/common/guards/jwt-auth.guard";
import {
  PermissionsGuard as RolesGuard,
  RequirePermissions,
} from "@/common/rbac";

@UseGuards(JwtAuthGuard, RolesGuard)
@RequirePermissions("notifications.view")
@Controller("notification-preferences")
export class NotificationPreferencesController {
  constructor(
    private readonly preferencesService: NotificationPreferencesService,
    private readonly featureFlags: FeatureFlagService,
  ) {}

  private assertPreferencesEnabled(): void {
    if (!this.featureFlags.notificationPreferencesEnabled) {
      throw new BadRequestException(
        "Notification preferences are currently unavailable. Please try again later.",
      );
    }
  }

  @Get()
  async getPreferences(@Request() req: any) {
    this.assertPreferencesEnabled();

    const preferences = await this.preferencesService.getPreferences(
      req.user.userId,
    );

    return {
      success: true,
      data: preferences,
      message: "Notification preferences retrieved successfully",
    };
  }

  @Put()
  @HttpCode(HttpStatus.OK)
  async updatePreferences(
    @Body() dto: UpdateNotificationPreferencesDto,
    @Request() req: any,
  ) {
    this.assertPreferencesEnabled();

    const preferences = await this.preferencesService.updatePreferences(
      req.user.userId,
      dto,
    );

    return {
      success: true,
      data: preferences,
      message: "Notification preferences updated successfully",
    };
  }

  @Put("disable-all")
  @HttpCode(HttpStatus.OK)
  async disableAll(@Request() req: any) {
    this.assertPreferencesEnabled();

    const preferences = await this.preferencesService.disableAllNotifications(
      req.user.userId,
    );

    return {
      success: true,
      data: preferences,
      message: "All notifications disabled",
    };
  }

  @Put("enable-all")
  @HttpCode(HttpStatus.OK)
  async enableAll(@Request() req: any) {
    this.assertPreferencesEnabled();

    const preferences = await this.preferencesService.enableAllNotifications(
      req.user.userId,
    );

    return {
      success: true,
      data: preferences,
      message: "All notifications enabled",
    };
  }
}
