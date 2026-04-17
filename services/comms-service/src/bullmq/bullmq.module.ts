import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";

/**
 * Registers the BullMQ Redis connection once for the entire comms-service.
 * All queue registrations and workers share this connection.
 *
 * Always imported — producers work regardless of WORKERS_ENABLED.
 */
@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>("REDIS_HOST", "localhost"),
          port: configService.get<number>("REDIS_PORT", 63790),
          password: configService.get<string>("REDIS_PASSWORD") || undefined,
        },
      }),
    }),
  ],
  exports: [BullModule],
})
export class BullMQCoreModule {}
