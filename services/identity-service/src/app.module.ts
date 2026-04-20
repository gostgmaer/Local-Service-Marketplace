import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { AuthModule } from "./modules/auth/auth.module";
import { UserModule } from "./modules/user/user.module";
import { RbacModule } from "./modules/rbac/rbac.module";
import { DatabaseModule } from "./common/database/database.module";
import { LoggerModule } from "./common/logger/logger.module";
import { RedisModule } from "./redis/redis.module";
import { NotificationModule } from "./common/notification/notification.module";
import { HealthController } from "./common/health/health.controller";
import { BullMQCoreModule } from "./bullmq/bullmq.module";
import { WorkersModule } from "./workers/workers.module";
import { GetCacheInterceptor } from "./common/interceptors/get-cache.interceptor";
import { CacheController } from "./common/controllers/cache.controller";
import { SharedModule } from "./common/shared.module";

const workersEnabled = process.env.WORKERS_ENABLED === "true";
const conditionalModules = workersEnabled ? [WorkersModule] : [];

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ".env" }),
    LoggerModule,
    DatabaseModule,
    BullMQCoreModule,
    RedisModule,
    SharedModule,
    NotificationModule,
    AuthModule,
    UserModule,
    RbacModule,
    ...conditionalModules,
  ],
  controllers: [HealthController, CacheController],
  providers: [
    { provide: APP_INTERCEPTOR, useClass: GetCacheInterceptor },
  ],
})
export class AppModule {}
