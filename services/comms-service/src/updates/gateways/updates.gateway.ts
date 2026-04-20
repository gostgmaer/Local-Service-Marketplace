import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SettingsCacheService } from "../../common/services/settings-cache.service";
import * as crypto from "crypto";

type AuthenticatedSocket = Socket & { userId?: string; userRole?: string };

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  },
  namespace: "/updates",
})
export class UpdatesGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(UpdatesGateway.name);
  private readonly userSockets = new Map<string, Set<string>>();
  private readonly jwtSecret: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly settingsCache: SettingsCacheService,
  ) {
    this.jwtSecret = this.configService.get<string>("JWT_SECRET", "");
  }

  afterInit() {
    this.logger.log("Updates WebSocket Gateway initialized");
  }

  async handleConnection(client: AuthenticatedSocket) {
    try {
      // Reject new connections when realtime is disabled
      if (!(await this.settingsCache.isRealtimeEnabled())) {
        client.emit("realtime_disabled");
        client.disconnect();
        return;
      }

      const token =
        client.handshake.auth?.token || client.handshake.query?.token;

      if (!token) {
        client.disconnect();
        return;
      }

      const payload = this.verifyJwt(token as string);
      if (!payload) {
        client.disconnect();
        return;
      }

      const userId = payload.userId || payload.sub;
      if (!userId) {
        client.disconnect();
        return;
      }

      client.userId = userId;
      client.userRole = payload.role;

      if (!this.userSockets.has(userId)) {
        this.userSockets.set(userId, new Set());
      }
      this.userSockets.get(userId)!.add(client.id);

      // Join personal room
      client.join(`user:${userId}`);

      // Join role-based rooms
      if (payload.role === "admin") {
        client.join("admin");
      }
      if (payload.role === "provider") {
        // All providers join a shared room so marketplace broadcasts (e.g. new requests)
        // can be delivered to every connected provider at once.
        client.join("providers");
      }
      if (payload.providerId) {
        client.join(`provider:${payload.providerId}`);
      }

      this.logger.log(`Updates client connected: user=${userId}`);
    } catch (error: any) {
      this.logger.error(`Updates connection error: ${error.message}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    const userId = client.userId;
    if (userId && this.userSockets.has(userId)) {
      const conns = this.userSockets.get(userId)!;
      conns.delete(client.id);
      if (conns.size === 0) {
        this.userSockets.delete(userId);
      }
    }
  }

  @SubscribeMessage("join")
  handleJoinRoom(@ConnectedSocket() client: AuthenticatedSocket, @MessageBody() room: string) {
    if (room && typeof room === "string") {
      client.join(room);
    }
  }

  broadcast(event: string, payload: any, rooms?: string[]) {
    if (rooms && rooms.length > 0) {
      for (const room of rooms) {
        this.server.to(room).emit(event, payload);
      }
    } else {
      this.server.emit(event, payload);
    }
  }

  isUserOnline(userId: string): boolean {
    const sockets = this.userSockets.get(userId);
    return sockets !== undefined && sockets.size > 0;
  }

  private verifyJwt(token: string): any {
    try {
      const parts = token.split(".");
      if (parts.length !== 3) return null;

      const [headerB64, payloadB64, signatureB64] = parts;
      const expectedSig = crypto
        .createHmac("sha256", this.jwtSecret)
        .update(`${headerB64}.${payloadB64}`)
        .digest("base64url");

      const sigBuf = Buffer.from(signatureB64, "base64url");
      const expectedBuf = Buffer.from(expectedSig, "base64url");

      if (
        sigBuf.length !== expectedBuf.length ||
        !crypto.timingSafeEqual(sigBuf, expectedBuf)
      ) {
        return null;
      }

      const payload = JSON.parse(
        Buffer.from(payloadB64, "base64url").toString("utf8"),
      );

      if (payload.exp && payload.exp * 1000 < Date.now()) {
        return null;
      }

      return payload;
    } catch {
      return null;
    }
  }
}
