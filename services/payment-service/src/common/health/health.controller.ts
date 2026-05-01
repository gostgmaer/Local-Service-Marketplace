import { Controller, Get, Inject } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { Pool } from "pg";
import axios from "axios";
import net from "net";

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
      const socket = net.connect({ host: redisHost, port: redisPort });

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
      userService: process.env.USER_SERVICE_URL,
      marketplaceService: process.env.MARKETPLACE_SERVICE_URL,
      notificationService: process.env.NOTIFICATION_SERVICE_URL,
      fileUploadService: process.env.FILE_UPLOAD_SERVICE_URL,
    };

    for (const [name, url] of Object.entries(dependencyTargets)) {
      if (!url || !url.trim()) {
        continue;
      }

      health.checks.dependencies[name] = await this.checkDependency(url);
      if (health.checks.dependencies[name].status === "down") {
        health.status = "down";
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
      let warnings = [];

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
