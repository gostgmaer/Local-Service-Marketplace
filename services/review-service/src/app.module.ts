import { Module } from '@nestjs/common';
import { LoggerModule } from './common/logger/logger.module';
import { DatabaseModule } from './common/database/database.module';
import { ReviewModule } from './review/review.module';

@Module({
  imports: [LoggerModule, DatabaseModule, ReviewModule],
})
export class AppModule {}
