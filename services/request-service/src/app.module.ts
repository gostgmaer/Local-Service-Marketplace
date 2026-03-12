import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RequestModule } from './modules/request/request.module';
import { DatabaseModule } from './common/database/database.module';
import { LoggerModule } from './common/logger/logger.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    LoggerModule,
    DatabaseModule,
    RequestModule,
  ],
})
export class AppModule {}
