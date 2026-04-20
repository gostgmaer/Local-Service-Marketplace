import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { LoggerModule } from "./common/logger/logger.module";
import { DatabaseModule } from "./common/database/database.module";
import { QueueModule } from "./queue/queue.module";
import { BullMQCoreModule } from "./bullmq/bullmq.module";
import { WorkersModule } from "./workers/workers.module";
import { KafkaModule } from "./kafka/kafka.module";
import { NotificationModule } from "./common/notification/notification.module";
import { UserModule } from "./common/user/user.module";
import { MarketplaceModule } from "./common/marketplace/marketplace.module";
import { PaymentModule } from "./payment/payment.module";
import { HealthController } from "./common/health/health.controller";
import { AnalyticsModule } from "./common/analytics/analytics.module";
import { RedisModule } from "./redis/redis.module";
import { GetCacheInterceptor } from "./common/interceptors/get-cache.interceptor";
import { CacheController } from "./common/controllers/cache.controller";
import { SharedModule } from "./common/shared.module";

const conditionalModules =
  process.env.WORKERS_ENABLED === "true" ? [WorkersModule] : [];

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    LoggerModule,
    DatabaseModule,
    BullMQCoreModule,
    QueueModule,
    RedisModule,
    SharedModule,
    ...conditionalModules,
    KafkaModule.register(),
    NotificationModule,
    UserModule,
    MarketplaceModule,
    PaymentModule,
    AnalyticsModule,
  ],
  controllers: [HealthController, CacheController],
  providers: [
    { provide: APP_INTERCEPTOR, useClass: GetCacheInterceptor },
  ],
})
export class AppModule {}
