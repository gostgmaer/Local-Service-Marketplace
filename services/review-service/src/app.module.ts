import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from './common/logger/logger.module';
import { DatabaseModule } from './common/database/database.module';
import { ReviewModule } from './review/review.module';
import { NotificationModule } from './common/notification/notification.module';
import { UserModule } from './common/user/user.module';
import { HealthController } from './common/health/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    LoggerModule,
    DatabaseModule,
    NotificationModule,
    UserModule,
    ReviewModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
