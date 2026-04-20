import { Injectable, Inject, LoggerService } from "@nestjs/common";
import { WINSTON_MODULE_NEST_PROVIDER } from "nest-winston";
import { SettingsCacheService } from "./settings-cache.service";

@Injectable()
export class BroadcastService {
  private readonly commsUrl: string;
  private readonly internalSecret: string;

  constructor(
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger: LoggerService,
    private readonly settingsCache: SettingsCacheService,
  ) {
    this.commsUrl =
      process.env.COMMS_SERVICE_URL || "http://localhost:3007";
    this.internalSecret = process.env.GATEWAY_INTERNAL_SECRET || "";
  }

  async emit(
    entityType: string,
    entityId: string,
    action: string,
    rooms?: string[],
    relatedIds?: Record<string, string>,
    userId?: string,
  ): Promise<void> {
    try {
      if (!(await this.settingsCache.isRealtimeEnabled())) return;

      const body = JSON.stringify({
        entityType,
        entityId,
        action,
        rooms,
        relatedIds,
        userId,
      });

      fetch(`${this.commsUrl}/updates/broadcast`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-internal-secret": this.internalSecret,
        },
        body,
      }).catch((err) => {
        this.logger.warn(
          `Broadcast failed for ${entityType}:${action}: ${err.message}`,
          "BroadcastService",
        );
      });
    } catch (error: any) {
      this.logger.warn(
        `Broadcast error for ${entityType}:${action}: ${error.message}`,
        "BroadcastService",
      );
    }
  }
}
