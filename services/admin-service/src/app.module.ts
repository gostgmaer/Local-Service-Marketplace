import { Module } from '@nestjs/common';
import { LoggerModule } from './common/logger/logger.module';
import { DatabaseModule } from './common/database/database.module';
import { AdminModule } from './admin/admin.module';

@Module({
  imports: [LoggerModule, DatabaseModule, AdminModule],
})
export class AppModule {}
