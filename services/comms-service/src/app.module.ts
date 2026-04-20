import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { ThrottlerModule } from "@nestjs/throttler";
import { NotificationModule } from "./notification/notification.module";
import { MessagingModule } from "./messaging/messaging.module";
import { UpdatesModule } from "./updates/updates.module";
import { DatabaseModule } from "./common/database/database.module";
import { LoggerModule } from "./common/logger/logger.module";
import { KafkaModule } from "./kafka/kafka.module";
import { BullMQCoreModule } from "./bullmq/bullmq.module";
import { QueueModule } from "./queue/queue.module";
import { HealthController } from "./common/health/health.controller";
import { RedisModule } from "./redis/redis.module";
import { GetCacheInterceptor } from "./common/interceptors/get-cache.interceptor";
import { CacheController } from "./common/controllers/cache.controller";
import { SharedModule } from "./common/shared.module";

// WorkersModule only loaded in worker pods (WORKERS_ENABLED=true)
import { WorkersModule } from "./workers/workers.module";
const workersEnabled = process.env.WORKERS_ENABLED === "true";
const workerModules = workersEnabled ? [WorkersModule] : [];

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ".env" }),
    ThrottlerModule.forRoot([
      { name: "email", ttl: 60000, limit: 10 },
      { name: "sms", ttl: 3600000, limit: 5 },
    ]),
    LoggerModule,
    DatabaseModule,
    BullMQCoreModule,
    QueueModule,
    RedisModule,
    SharedModule,
    KafkaModule.register(),
    NotificationModule,
    MessagingModule,
    UpdatesModule,
    ...workerModules,
  ],
  controllers: [HealthController, CacheController],
  providers: [
    { provide: APP_INTERCEPTOR, useClass: GetCacheInterceptor },
  ],
})
export class AppModule {}
