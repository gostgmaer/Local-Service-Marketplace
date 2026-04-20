import { Injectable } from "@nestjs/common";
import { UpdatesGateway } from "./gateways/updates.gateway";
import { BroadcastDto } from "./dto/broadcast.dto";

@Injectable()
export class UpdatesService {
  constructor(private readonly gateway: UpdatesGateway) {}

  broadcast(dto: BroadcastDto): void {
    const event = `${dto.entityType}:${dto.action}`;
    const payload = {
      entityType: dto.entityType,
      entityId: dto.entityId,
      action: dto.action,
      userId: dto.userId,
      relatedIds: dto.relatedIds,
      data: dto.data,
      timestamp: new Date().toISOString(),
    };

    this.gateway.broadcast(event, payload, dto.rooms);
  }

  isUserOnline(userId: string): boolean {
    return this.gateway.isUserOnline(userId);
  }
}
