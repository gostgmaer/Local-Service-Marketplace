import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from './common/logger/logger.module';
import { DatabaseModule } from './common/database/database.module';
import { KafkaModule } from './kafka/kafka.module';
import { QueueModule } from './queue/queue.module';
import { NotificationModule } from './notification/notification.module';
import { HealthController } from './common/health/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    // Rate limiting: 10 emails per minute per IP, 5 SMS per hour per IP
    ThrottlerModule.forRoot([
      {
        name: 'email',
        ttl: 60000, // 60 seconds
        limit: 10, // 10 requests per minute
      },
      {
        name: 'sms',
        ttl: 3600000, // 1 hour
        limit: 5, // 5 requests per hour
      },
    ]),
    LoggerModule,
    DatabaseModule,
    QueueModule,
    KafkaModule,
    NotificationModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
