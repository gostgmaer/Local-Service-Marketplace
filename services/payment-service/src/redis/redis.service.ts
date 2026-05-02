import {
  Injectable,
  OnModuleDestroy,
  Inject,
  LoggerService,
} from "@nestjs/common";
import { WINSTON_MODULE_NEST_PROVIDER } from "nest-winston";
import Redis from "ioredis";

@Injectable()
export class RedisService implements OnModuleDestroy {
  private redisClient: Redis;
  private cacheEnabled: boolean;

  constructor(
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger: LoggerService,
  ) {
    this.cacheEnabled = process.env.CACHE_ENABLED === "true";

    if (this.cacheEnabled) {
      this.redisClient = new Redis({
        host: process.env.REDIS_HOST || "localhost",
        port: parseInt(process.env.REDIS_PORT) || 6379,
        password: process.env.REDIS_PASSWORD || undefined,
        retryStrategy: (times) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
      });

      this.redisClient.on("connect", () => {
        this.logger.log("Redis cache connected successfully", "RedisService");
      });

      this.redisClient.on("error", (err: any) => {
        this.logger.error(
          `Redis connection error: ${err.message}`,
          err.stack,
          "RedisService",
        );
        this.cacheEnabled = false;
      });
    } else {
      this.logger.log("Redis cache is disabled", "RedisService");
    }
  }

  async onModuleDestroy() {
    if (this.redisClient) {
      await this.redisClient.quit();
    }
  }

  isCacheEnabled(): boolean {
    return this.cacheEnabled;
  }

  async get(key: string): Promise<string | null> {
    if (!this.cacheEnabled) return null;
    try {
      return await this.redisClient.get(key);
    } catch (error: any) {
      this.logger.error(
        `Redis GET error for key ${key}: ${error.message}`,
        error.stack,
        "RedisService",
      );
      return null;
    }
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    if (!this.cacheEnabled) return;
    try {
      if (ttl) {
        await this.redisClient.setex(key, ttl, value);
      } else {
        await this.redisClient.set(key, value);
      }
    } catch (error: any) {
      this.logger.error(
        `Redis SET error for key ${key}: ${error.message}`,
        error.stack,
        "RedisService",
      );
    }
  }

  async del(key: string): Promise<void> {
    if (!this.cacheEnabled) return;
    try {
      await this.redisClient.del(key);
    } catch (error: any) {
      this.logger.error(
        `Redis DEL error for key ${key}: ${error.message}`,
        error.stack,
        "RedisService",
      );
    }
  }

  async delPattern(pattern: string): Promise<void> {
    if (!this.cacheEnabled) return;
    try {
      let cursor = "0";
      do {
        const [nextCursor, keys] = await this.redisClient.scan(
          cursor,
          "MATCH",
          pattern,
          "COUNT",
          100,
        );
        cursor = nextCursor;
        if (keys.length > 0) {
          await this.redisClient.del(...keys);
        }
      } while (cursor !== "0");
    } catch (error: any) {
      this.logger.error(
        `Redis DEL pattern error for ${pattern}: ${error.message}`,
        error.stack,
        "RedisService",
      );
    }
  }

  async exists(key: string): Promise<boolean> {
    if (!this.cacheEnabled) return false;
    try {
      const result = await this.redisClient.exists(key);
      return result === 1;
    } catch (error: any) {
      this.logger.error(
        `Redis EXISTS error for key ${key}: ${error.message}`,
        error.stack,
        "RedisService",
      );
      return false;
    }
  }
}
