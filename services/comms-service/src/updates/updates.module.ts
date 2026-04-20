import { Module } from "@nestjs/common";
import { UpdatesGateway } from "./gateways/updates.gateway";
import { UpdatesService } from "./updates.service";
import { UpdatesController } from "./updates.controller";

@Module({
  controllers: [UpdatesController],
  providers: [UpdatesGateway, UpdatesService],
  exports: [UpdatesService],
})
export class UpdatesModule {}
