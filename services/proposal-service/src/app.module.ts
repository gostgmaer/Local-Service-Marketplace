import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from './common/logger/logger.module';
import { DatabaseModule } from './common/database/database.module';
import { KafkaModule } from './kafka/kafka.module';
import { NotificationModule } from './common/notification/notification.module';
import { UserModule } from './common/user/user.module';
import { ProposalModule } from './modules/proposal/proposal.module';
import { HealthController } from './common/health/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    LoggerModule,
    DatabaseModule,
    KafkaModule,
    NotificationModule,
    UserModule,
    ProposalModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
