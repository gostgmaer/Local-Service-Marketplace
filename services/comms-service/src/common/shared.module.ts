import { Module, Global } from "@nestjs/common";
import { CacheInvalidationService } from "./services/cache-invalidation.service";
import { SettingsCacheService } from "./services/settings-cache.service";

@Global()
@Module({
  providers: [CacheInvalidationService, SettingsCacheService],
  exports: [CacheInvalidationService, SettingsCacheService],
})
export class SharedModule {}
