import { Controller, Post, UseGuards } from "@nestjs/common";
import { CacheInvalidationService } from "../services/cache-invalidation.service";
import { InternalServiceGuard } from "../guards/internal-service.guard";

@Controller("cache")
@UseGuards(InternalServiceGuard)
export class CacheController {
  constructor(
    private readonly cacheInvalidationService: CacheInvalidationService,
  ) {}

  @Post("flush-all")
  async flushAll() {
    await this.cacheInvalidationService.invalidateAll();
    return { message: "Cache flushed" };
  }
}
