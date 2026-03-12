import { Module, Global } from '@nestjs/common';
import { Pool } from 'pg';

const databasePoolFactory = async () => {
  const pool = new Pool({
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT) || 5443,
    user: process.env.DATABASE_USER || 'infrastructure_user',
    password: process.env.DATABASE_PASSWORD || 'infrastructure_password',
    database: process.env.DATABASE_NAME || 'infrastructure_service_db',
    max: 20,
  });

  return pool;
};

@Global()
@Module({
  providers: [
    {
      provide: 'DATABASE_POOL',
      useFactory: databasePoolFactory,
    },
  ],
  exports: ['DATABASE_POOL'],
})
export class DatabaseModule {}
