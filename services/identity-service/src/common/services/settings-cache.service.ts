import { Injectable, Inject } from "@nestjs/common";
import { Pool } from "pg";

@Injectable()
export class SettingsCacheService {
  private cache = new Map<string, { value: string; fetchedAt: number }>();
  private readonly TTL_MS = 60_000; // 60 seconds in-memory cache

  constructor(@Inject("DATABASE_POOL") private readonly pool: Pool) {}

  async getSetting(key: string, defaultValue: string): Promise<string> {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.fetchedAt < this.TTL_MS) {
      return cached.value;
    }

    try {
      const result = await this.pool.query(
        "SELECT value FROM system_settings WHERE key = $1",
        [key],
      );
      const value = result.rows[0]?.value ?? defaultValue;
      this.cache.set(key, { value, fetchedAt: Date.now() });
      return value;
    } catch {
      return defaultValue;
    }
  }

  async isCacheEnabled(): Promise<boolean> {
    const val = await this.getSetting("get_cache_enabled", "false");
    return val === "true";
  }

  async getCacheTtl(): Promise<number> {
    const val = await this.getSetting("cache_ttl_seconds", "300");
    return parseInt(val, 10) || 300;
  }
}
