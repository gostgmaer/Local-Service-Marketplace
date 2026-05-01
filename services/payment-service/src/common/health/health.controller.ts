import { Controller, Get, Inject, Query } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { Pool } from "pg";
import axios from "axios";
import { connect } from "net";

type HealthStatus = "ok" | "down";

@Controller("health")
export class HealthController {
  constructor(
    @Inject("DATABASE_POOL") private readonly pool: Pool,
    @InjectQueue("payment.notification")
    private readonly notificationQueue: Queue,
    @InjectQueue("payment.analytics") private readonly analyticsQueue: Queue,
    @InjectQueue("payment.refund") private readonly refundQueue: Queue,
    @InjectQueue("payment.webhook") private readonly webhookQueue: Queue,
  ) {}

  private normalizeStatus(status: unknown): HealthStatus {
    const value = String(status ?? "")
      .toLowerCase()
      .trim();
    const isHealthy =
      value === "ok" ||
      value === "healthy" ||
      value === "up" ||
      value === "success";
    return isHealthy ? "ok" : "down";
  }

  private isInternalDependency(url: string): boolean {
    const normalized = url.toLowerCase();
    return (
      normalized.includes("://identity-service") ||
      normalized.includes("://marketplace-service") ||
      normalized.includes("://payment-service") ||
      normalized.includes("://comms-service") ||
      normalized.includes("://oversight-service") ||
      normalized.includes("://infrastructure-service") ||
      normalized.includes("://localhost") ||
      normalized.includes("://127.0.0.1")
    );
  }

  private buildDependencyHealthUrl(url: string): string {
    const baseUrl = url.trim().replace(/\/+$/, "");
    const lowerBaseUrl = baseUrl.toLowerCase();

    if (/(?:\/v1)?\/health(?:$|[?#])/.test(lowerBaseUrl)) {
      return baseUrl;
    }

    if (
      lowerBaseUrl.includes("notification-service") &&
      !lowerBaseUrl.includes("comms-service")
    ) {
      return `${baseUrl}/v1/health`;
    }

    return `${baseUrl}/health`;
  }

  private async checkDependency(url: string): Promise<any> {
    let healthUrl = this.buildDependencyHealthUrl(url);
    if (this.isInternalDependency(healthUrl)) {
      healthUrl = `${healthUrl}${healthUrl.includes("?") ? "&" : "?"}depth=0`;
    }
    const startedAt = Date.now();

    try {
      const response = await axios.get(healthUrl, {
        timeout: 3000,
        validateStatus: () => true,
      });

      const payload =
        response.data &&
        typeof response.data === "object" &&
        "data" in response.data
          ? (response.data as any).data
          : response.data;
      const standardizedFailure =
        response.data &&
        typeof response.data === "object" &&
        "success" in response.data &&
        (response.data as any).success === false;

      const reachable =
        response.status >= 200 && response.status < 400 && !standardizedFailure;
      const upstreamStatus = payload?.status
        ? this.normalizeStatus(payload.status)
        : "ok";
      const status: HealthStatus =
        reachable && upstreamStatus === "ok" ? "ok" : "down";
      let message: string | undefined;
      if (status === "down") {
        if (standardizedFailure) {
          message =
            (response.data as any)?.message ??
            "Dependency health response reported failure";
        } else if (reachable) {
          message = `Dependency reported status: ${payload?.status ?? "unknown"}`;
        } else {
          message = `Dependency returned HTTP ${response.status}`;
        }
      }

      return {
        status,
        httpStatus: response.status,
        responseTime: `${Date.now() - startedAt}ms`,
        message,
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
  async check(@Query("depth") depth?: string) {
    const shouldCheckDependencies = depth !== "0";

    const health: any = {
      status: "ok",
      service: "payment-service",
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
      userService:
        process.env.USER_SERVICE_URL || process.env.IDENTITY_SERVICE_URL,
      marketplaceService: process.env.MARKETPLACE_SERVICE_URL,
      notificationService: process.env.NOTIFICATION_SERVICE_URL,
      fileUploadService: process.env.FILE_UPLOAD_SERVICE_URL,
    };

    if (shouldCheckDependencies) {
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
    }

    // Backward-compatible aliases.
    health.database = health.checks.database;
    health.redis = health.checks.redis;
    health.dependencies = health.checks.dependencies;

    return health;
  }

  @Get("queues")
  async checkQueues() {
    try {
      const [notificationCounts, analyticsCounts, refundCounts, webhookCounts] =
        await Promise.all([
          this.notificationQueue.getJobCounts(),
          this.analyticsQueue.getJobCounts(),
          this.refundQueue.getJobCounts(),
          this.webhookQueue.getJobCounts(),
        ]);

      const queues = {
        "payment.notification": {
          waiting: notificationCounts.waiting || 0,
          active: notificationCounts.active || 0,
          completed: notificationCounts.completed || 0,
          failed: notificationCounts.failed || 0,
          delayed: notificationCounts.delayed || 0,
        },
        "payment.analytics": {
          waiting: analyticsCounts.waiting || 0,
          active: analyticsCounts.active || 0,
          completed: analyticsCounts.completed || 0,
          failed: analyticsCounts.failed || 0,
          delayed: analyticsCounts.delayed || 0,
        },
        "payment.refund": {
          waiting: refundCounts.waiting || 0,
          active: refundCounts.active || 0,
          completed: refundCounts.completed || 0,
          failed: refundCounts.failed || 0,
          delayed: refundCounts.delayed || 0,
        },
        "payment.webhook": {
          waiting: webhookCounts.waiting || 0,
          active: webhookCounts.active || 0,
          completed: webhookCounts.completed || 0,
          failed: webhookCounts.failed || 0,
          delayed: webhookCounts.delayed || 0,
        },
      };

      // Calculate health status based on queue metrics
      let status = "ok";
      const warnings = [];

      Object.entries(queues).forEach(([queueName, counts]) => {
        if (counts.failed > 100) {
          warnings.push(
            `${queueName}: High failed job count (${counts.failed})`,
          );
          status = "degraded";
        }
        if (counts.waiting > 1000) {
          warnings.push(
            `${queueName}: High waiting job count (${counts.waiting})`,
          );
          status = "degraded";
        }
      });

      return {
        status,
        timestamp: new Date().toISOString(),
        queues,
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    } catch (error: any) {
      return {
        status: "error",
        message: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }
}
