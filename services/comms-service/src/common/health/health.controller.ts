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
    @InjectQueue("comms.email") private readonly emailQueue: Queue,
    @InjectQueue("comms.sms") private readonly smsQueue: Queue,
    @InjectQueue("comms.push") private readonly pushQueue: Queue,
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

  private checkFcmReadiness(): any {
    const fcmEnabled = process.env.FCM_ENABLED === "true";
    if (!fcmEnabled) {
      return {
        status: "ok",
        enabled: false,
        message: "FCM is disabled",
      };
    }

    const missing = ["FIREBASE_PROJECT_ID", "FIREBASE_CLIENT_EMAIL", "FIREBASE_PRIVATE_KEY"].filter(
      (key) => !process.env[key],
    );

    if (missing.length > 0) {
      return {
        status: "down",
        enabled: true,
        message: `Missing FCM credentials: ${missing.join(", ")}`,
      };
    }

    return {
      status: "ok",
      enabled: true,
    };
  }

  @Get()
  async check() {
    const health: any = {
      status: "ok",
      service: "comms-service",
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
        message: error instanceof Error ? error.message : String(error),
      };
    }

    health.checks.redis = await this.checkRedis();
    if (health.checks.redis.status === "down") {
      health.status = "down";
    }

    const dependencyTargets: Record<string, string | undefined> = {
      userService: process.env.USER_SERVICE_URL,
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

    health.checks.dependencies.fcm = this.checkFcmReadiness();
    if (health.checks.dependencies.fcm.status === "down") {
      health.status = "down";
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
      const [emailCounts, smsCounts, pushCounts] = await Promise.all([
        this.emailQueue.getJobCounts(),
        this.smsQueue.getJobCounts(),
        this.pushQueue.getJobCounts(),
      ]);

      return {
        status: "ok",
        timestamp: new Date().toISOString(),
        queues: {
          "comms.email": {
            waiting: emailCounts.waiting || 0,
            active: emailCounts.active || 0,
            completed: emailCounts.completed || 0,
            failed: emailCounts.failed || 0,
            delayed: emailCounts.delayed || 0,
          },
          "comms.sms": {
            waiting: smsCounts.waiting || 0,
            active: smsCounts.active || 0,
            completed: smsCounts.completed || 0,
            failed: smsCounts.failed || 0,
            delayed: smsCounts.delayed || 0,
          },
          "comms.push": {
            waiting: pushCounts.waiting || 0,
            active: pushCounts.active || 0,
            completed: pushCounts.completed || 0,
            failed: pushCounts.failed || 0,
            delayed: pushCounts.delayed || 0,
          },
        },
      };
    } catch (error: any) {
      return {
        status: "error",
        message: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      };
    }
  }
}
