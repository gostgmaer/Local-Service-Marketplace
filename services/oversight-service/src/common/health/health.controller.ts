import { Controller, Get, Inject } from "@nestjs/common";
import { Pool } from "pg";
import axios from "axios";
import { connect } from "net";

type HealthStatus = "ok" | "down";

@Controller("health")
export class HealthController {
  constructor(@Inject("DATABASE_POOL") private readonly pool: Pool) {}

  private normalizeStatus(status: unknown): HealthStatus {
    const value = String(status ?? "")
      .toLowerCase()
      .trim();
    return value === "ok" || value === "healthy" || value === "up"
      ? "ok"
      : "down";
  }

  private async checkDependency(url: string): Promise<any> {
    const baseUrl = url.trim().replace(/\/+$/, "");
    const healthUrl = `${baseUrl}/health`;
    const startedAt = Date.now();

    try {
      const response = await axios.get(healthUrl, {
        timeout: 3000,
        validateStatus: () => true,
      });

      const reachable = response.status < 500;
      const upstreamStatus = response.data?.status
        ? this.normalizeStatus(response.data.status)
        : "ok";
      const status: HealthStatus =
        reachable && upstreamStatus === "ok" ? "ok" : "down";

      return {
        status,
        httpStatus: response.status,
        responseTime: `${Date.now() - startedAt}ms`,
        message:
          status === "down"
            ? reachable
              ? `Dependency reported status: ${response.data?.status ?? "unknown"}`
              : `Dependency returned HTTP ${response.status}`
            : undefined,
      };
    } catch (error: any) {
      return {
        status: "down",
        responseTime: `${Date.now() - startedAt}ms`,
        message: error?.message ?? "Dependency check failed",
      };
    }
  }

  private async checkRedis(): Promise<any> {
    const redisEnabled =
      process.env.CACHE_ENABLED === "true" ||
      process.env.WORKERS_ENABLED === "true" ||
      process.env.REDIS_RATE_LIMIT_ENABLED === "true";
    const redisHost = (process.env.REDIS_HOST || "").trim();
    const redisPort = Number.parseInt(process.env.REDIS_PORT || "6379", 10);

    if (!redisEnabled && !redisHost) {
      return {
        status: "ok",
        enabled: false,
        message: "Redis is disabled",
      };
    }

    if (!redisHost) {
      return {
        status: redisEnabled ? "down" : "ok",
        enabled: redisEnabled,
        message: "REDIS_HOST is not configured",
      };
    }

    const startedAt = Date.now();
    return new Promise((resolve) => {
      const socket = connect({ host: redisHost, port: redisPort });

      const finalize = (payload: any) => {
        socket.removeAllListeners();
        if (!socket.destroyed) {
          socket.destroy();
        }
        resolve(payload);
      };

      socket.setTimeout(2000);
      socket.once("connect", () => {
        finalize({
          status: "ok",
          enabled: true,
          responseTime: `${Date.now() - startedAt}ms`,
        });
      });
      socket.once("timeout", () => {
        finalize({
          status: "down",
          enabled: true,
          responseTime: `${Date.now() - startedAt}ms`,
          message: "Redis connection timed out",
        });
      });
      socket.once("error", (error: Error) => {
        finalize({
          status: "down",
          enabled: true,
          responseTime: `${Date.now() - startedAt}ms`,
          message: error.message,
        });
      });
    });
  }

  @Get()
  async check() {
    const health: any = {
      status: "ok",
      service: "oversight-service",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      checks: {
        database: { status: "down" as HealthStatus },
        redis: { status: "down" as HealthStatus },
        dependencies: {},
      },
    };

    try {
      const start = Date.now();
      await this.pool.query("SELECT 1");
      health.checks.database = {
        status: "ok",
        responseTime: `${Date.now() - start}ms`,
      };
    } catch (error: any) {
      health.status = "down";
      health.checks.database = {
        status: "down",
        message: error?.message ?? "Database check failed",
      };
    }

    health.checks.redis = await this.checkRedis();
    if (health.checks.redis.status === "down") {
      health.status = "down";
    }

    const dependencyTargets: Record<string, string | undefined> = {
      notificationService: process.env.NOTIFICATION_SERVICE_URL,
      identityService: process.env.IDENTITY_SERVICE_URL,
      marketplaceService: process.env.MARKETPLACE_SERVICE_URL,
      paymentService: process.env.PAYMENT_SERVICE_URL,
    };

    const dependencyEntries = Object.entries(dependencyTargets).filter(
      ([, url]) => Boolean(url && url.trim()),
    ) as Array<[string, string]>;

    const dependencyResults = await Promise.all(
      dependencyEntries.map(async ([name, url]) => {
        const result = await this.checkDependency(url);
        return [name, result] as const;
      }),
    );

    for (const [name, result] of dependencyResults) {
      health.checks.dependencies[name] = result;
      if (result.status === "down") {
        health.status = "down";
      }
    }

    // Backward-compatible aliases.
    health.database = health.checks.database;
    health.redis = health.checks.redis;
    health.dependencies = health.checks.dependencies;

    return health;
  }
}
