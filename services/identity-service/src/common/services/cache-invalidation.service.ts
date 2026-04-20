import { Injectable } from "@nestjs/common";
import { RedisService } from "../../redis/redis.service";

@Injectable()
export class CacheInvalidationService {
  private readonly SERVICE_NAME = "identity";

  constructor(private readonly redisService: RedisService) {}

  async invalidateEntity(entityPrefix: string): Promise<void> {
    await this.redisService.delPattern(`cache:${this.SERVICE_NAME}:${entityPrefix}:*`);
  }

  async invalidateAll(): Promise<void> {
    await this.redisService.delPattern(`cache:${this.SERVICE_NAME}:*`);
  }
}
