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
        port: parseInt(process.env.REDIS_PORT || "6379", 10),
        password: process.env.REDIS_PASSWORD || undefined,
        retryStrategy: (times) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
      });

      this.redisClient.on("connect", () => {
        this.logger.log("Redis connected successfully", "RedisService");
      });

      this.redisClient.on("error", (err: Error) => {
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

  getClient(): Redis | null {
    if (!this.cacheEnabled) {
      this.logger.warn(
        "Attempted to get Redis client but cache is disabled",
        "RedisService",
      );
      return null;
    }
    return this.redisClient;
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    if (!this.cacheEnabled || !this.redisClient) return;
    if (ttl) {
      await this.redisClient.setex(key, ttl, value);
    } else {
      await this.redisClient.set(key, value);
    }
  }

  async get(key: string): Promise<string | null> {
    if (!this.cacheEnabled || !this.redisClient) return null;
    return this.redisClient.get(key);
  }

  async del(key: string): Promise<number> {
    if (!this.cacheEnabled || !this.redisClient) return 0;
    return this.redisClient.del(key);
  }

  async incr(key: string): Promise<number> {
    if (!this.cacheEnabled || !this.redisClient) return 0;
    return this.redisClient.incr(key);
  }

  async expire(key: string, seconds: number): Promise<number> {
    if (!this.cacheEnabled || !this.redisClient) return 0;
    return this.redisClient.expire(key, seconds);
  }

  async exists(key: string): Promise<number> {
    if (!this.cacheEnabled || !this.redisClient) return 0;
    return this.redisClient.exists(key);
  }

  async delPattern(pattern: string): Promise<void> {
    if (!this.cacheEnabled || !this.redisClient) return;

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
}
