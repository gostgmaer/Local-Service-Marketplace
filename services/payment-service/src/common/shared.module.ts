import { Module, Global } from "@nestjs/common";
import { CacheInvalidationService } from "./services/cache-invalidation.service";
import { BroadcastService } from "./services/broadcast.service";
import { SettingsCacheService } from "./services/settings-cache.service";

@Global()
@Module({
  providers: [CacheInvalidationService, BroadcastService, SettingsCacheService],
  exports: [CacheInvalidationService, BroadcastService, SettingsCacheService],
})
export class SharedModule {}
