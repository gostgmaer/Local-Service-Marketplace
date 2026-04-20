import { Controller, Post, Body, UseGuards } from "@nestjs/common";
import { UpdatesService } from "./updates.service";
import { BroadcastDto } from "./dto/broadcast.dto";
import { InternalServiceGuard } from "../common/guards/internal-service.guard";

@Controller("updates")
@UseGuards(InternalServiceGuard)
export class UpdatesController {
  constructor(private readonly updatesService: UpdatesService) {}

  @Post("broadcast")
  broadcast(@Body() dto: BroadcastDto) {
    this.updatesService.broadcast(dto);
    return { ok: true };
  }
}
