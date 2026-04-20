import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from "@nestjs/common";
import { Observable, of } from "rxjs";
import { tap } from "rxjs/operators";
import { RedisService } from "../../redis/redis.service";
import { SettingsCacheService } from "../services/settings-cache.service";
import * as crypto from "crypto";

const ENTITY_MAP: Record<string, string> = {
  "/admin/disputes": "disputes",
  "/admin/audit-logs": "auditlogs",
  "/admin/settings": "settings",
  "/admin/contact": "contact",
  "/disputes": "disputes",
  "/analytics": "analytics",
  "/public": "public",
};

@Injectable()
export class GetCacheInterceptor implements NestInterceptor {
  private readonly SERVICE_NAME = "oversight";

  constructor(
    private readonly redisService: RedisService,
    private readonly settingsCache: SettingsCacheService,
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    if (request.method !== "GET") return next.handle();

    const enabled = await this.settingsCache.isCacheEnabled();
    if (!enabled) return next.handle();

    const entityPrefix = this.resolveEntityPrefix(request.url);
    const userId = request.user?.id || "anon";
    const queryHash = crypto
      .createHash("md5")
      .update(JSON.stringify(request.query || {}))
      .digest("hex")
      .slice(0, 12);
    const cacheKey = `cache:${this.SERVICE_NAME}:${entityPrefix}:${request.url.split("?")[0]}:${queryHash}:${userId}`;

    const cached = await this.redisService.get(cacheKey);
    if (cached) {
      return of(JSON.parse(cached));
    }

    const ttl = await this.settingsCache.getCacheTtl();
    return next.handle().pipe(
      tap(async (response) => {
        try {
          await this.redisService.set(cacheKey, JSON.stringify(response), ttl);
        } catch {}
      }),
    );
  }

  private resolveEntityPrefix(url: string): string {
    const path = url.split("?")[0];
    for (const [route, prefix] of Object.entries(ENTITY_MAP)) {
      if (path.startsWith(route)) return prefix;
    }
    return "general";
  }
}
