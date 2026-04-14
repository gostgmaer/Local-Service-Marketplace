import { Module, Global } from "@nestjs/common";
import Redis from "ioredis";
import { RedisService } from "./redis.service";
import { CacheWarmingService } from "./cache-warming.service";
import { UserModule } from "../modules/user/user.module";

import { ConfigModule, ConfigService } from "@nestjs/config";

const redisClientProvider = {
  provide: "REDIS_CLIENT",
  useFactory: (configService: ConfigService): Redis => {
    const client = new Redis({
      host: configService.get<string>("REDIS_HOST", "localhost"),
      port: configService.get<number>("REDIS_PORT", 63790),
      password: configService.get<string>("REDIS_PASSWORD") || undefined,
      lazyConnect: true,
      retryStrategy: (times) => {
        if (times > 5) return null; // stop retrying — fail gracefully
        return Math.min(times * 100, 2000);
      },
    });
    client.on("error", () => {}); // swallow connection errors (fail-open policy)
    return client;
  },
  inject: [ConfigService],
};

@Global()
@Module({
  imports: [UserModule],
  providers: [redisClientProvider, RedisService, CacheWarmingService],
  exports: ["REDIS_CLIENT", RedisService],
})
export class RedisModule {}
