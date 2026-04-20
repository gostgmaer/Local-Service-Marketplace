import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { AdminModule } from "./admin/admin.module";
import { AnalyticsModule } from "./analytics/analytics.module";
import { DatabaseModule } from "./common/database/database.module";
import { LoggerModule } from "./common/logger/logger.module";
import { KafkaModule } from "./kafka/kafka.module";
import { HealthController } from "./common/health/health.controller";
import { BullMQCoreModule } from "./bullmq/bullmq.module";
import { WorkersModule } from "./workers/workers.module";
import { RedisModule } from "./redis/redis.module";
import { GetCacheInterceptor } from "./common/interceptors/get-cache.interceptor";
import { CacheController } from "./common/controllers/cache.controller";
import { SharedModule } from "./common/shared.module";

const conditionalModules =
  process.env.WORKERS_ENABLED === "true" ? [WorkersModule] : [];

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ".env" }),
    LoggerModule,
    DatabaseModule,
    BullMQCoreModule,
    RedisModule,
    SharedModule,
    KafkaModule.register(),
    AdminModule,
    AnalyticsModule,
    ...conditionalModules,
  ],
  controllers: [HealthController, CacheController],
  providers: [
    { provide: APP_INTERCEPTOR, useClass: GetCacheInterceptor },
  ],
})
export class AppModule {}
