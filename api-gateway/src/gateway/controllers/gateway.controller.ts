import {
  Controller,
  Get,
  All,
  Req,
  Res,
  Param,
  Inject,
  LoggerService,
} from "@nestjs/common";
import { Request, Response } from "express";
import { WINSTON_MODULE_NEST_PROVIDER } from "nest-winston";
import { GatewayService } from "../services/gateway.service";

@Controller("api/v1")
export class GatewayController {
  constructor(
    private readonly gatewayService: GatewayService,
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger: LoggerService,
  ) {}

  private buildServicesPayload(rawHealth: Record<string, any>) {
    const infrastructureEnabled =
      (process.env.INFRASTRUCTURE_ENABLED || "false") === "true";

    const serviceMap: Record<string, string> = {
      "identity-service": "identity",
      "marketplace-service": "marketplace",
      "payment-service": "payment",
      "comms-service": "comms",
      "oversight-service": "oversight",
    };

    if (infrastructureEnabled) {
      serviceMap["infrastructure-service"] = "infrastructure";
    }

    const services: Record<string, any> = {};
    for (const [fullName, shortName] of Object.entries(serviceMap)) {
      services[shortName] = rawHealth[fullName] ?? {
        status: "down",
        message: "Health data unavailable",
      };
    }

    const downServices = Object.entries(services)
      .filter(([, svc]) => svc?.status !== "ok")
      .map(([name]) => name);

    return {
      status: downServices.length === 0 ? "ok" : "down",
      services,
      summary: {
        total: Object.keys(services).length,
        ok: Object.keys(services).length - downServices.length,
        down: downServices.length,
        downServices,
      },
    };
  }

  /**
   * Gateway self health check – exposed under /api/v1/health so Newman tests
   * can reach it without going through the proxy catch-all.
   * Includes downstream microservice health in `services`.
   */
  @Get("health")
  async gatewayHealth(@Res() res: Response): Promise<void> {
    const rawHealth = await this.gatewayService.healthCheck();
    const aggregate = this.buildServicesPayload(rawHealth);

    (res as any).status(200).json({
      status: aggregate.status,
      gateway: "api-gateway",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      services: aggregate.services,
      summary: aggregate.summary,
    });
  }

  /**
   * Aggregate health of all downstream microservices.
   * Always returns HTTP 200; use the `status` field (`ok` | `down`) to detect outages.
   */
  @Get("health/services")
  async servicesHealth(@Res() res: Response): Promise<void> {
    const rawHealth = await this.gatewayService.healthCheck();
    const aggregate = this.buildServicesPayload(rawHealth);

    (res as any).status(200).json({
      status: aggregate.status,
      timestamp: new Date().toISOString(),
      services: aggregate.services,
      summary: aggregate.summary,
    });
  }

  /**
   * Catch-all route handler
   * Forwards all requests to appropriate microservices
   */
  @All("*")
  async handleRequest(
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    try {
      const { method, path, body, headers, query } = req;

      this.logger.log(
        `Gateway received ${method} ${path}`,
        "GatewayController",
      );

      // Forward request to microservice with user context
      const isMultipart = headers["content-type"]?.includes(
        "multipart/form-data",
      );

      const response = await this.gatewayService.forwardRequest(
        path,
        method,
        isMultipart ? req : body,
        headers,
        query,
        (req as any).user, // Pass decoded JWT user info
        isMultipart,
      );

      // Forward response headers from microservice
      if (response.headers) {
        Object.keys(response.headers).forEach((key) => {
          // Skip certain headers that shouldn't be forwarded
          if (
            ![
              "content-encoding",
              "transfer-encoding",
              "connection",
              "keep-alive",
            ].includes(key.toLowerCase())
          ) {
            res.setHeader(key, response.headers[key]);
          }
        });
      }

      // Pass through redirects as-is (needed for OAuth browser flows)
      if (
        response.status >= 300 &&
        response.status < 400 &&
        response.headers?.location
      ) {
        return res.redirect(response.status, response.headers.location);
      }

      // Microservices now return standardized responses, pass them through as-is
      res.status(response.status).json(response.data);
    } catch (error: any) {
      this.logger.error(
        `Gateway error: ${error.message}`,
        error.stack,
        "GatewayController",
      );

      // Handle error responses in standardized format
      const status = error.status || 500;
      const message =
        error.response?.message || error.message || "Internal server error";

      // Echo correlation ID so the client can match the error to server logs
      const requestId = req.headers["x-request-id"] as string | undefined;
      if (requestId) {
        res.setHeader("x-request-id", requestId);
      }

      // Send standardized error response
      res.status(status).json({
        success: false,
        statusCode: status,
        message: message,
        error: { code: this.getErrorCode(status), message, details: [] },
      });
    }
  }

  private getErrorCode(status: number): string {
    switch (status) {
      case 400:
        return "BAD_REQUEST";
      case 401:
        return "UNAUTHORIZED";
      case 403:
        return "FORBIDDEN";
      case 404:
        return "NOT_FOUND";
      case 409:
        return "CONFLICT";
      case 422:
        return "VALIDATION_ERROR";
      case 429:
        return "RATE_LIMIT_EXCEEDED";
      case 500:
        return "INTERNAL_ERROR";
      case 503:
        return "SERVICE_UNAVAILABLE";
      case 504:
        return "GATEWAY_TIMEOUT";
      default:
        return "UNKNOWN_ERROR";
    }
  }
}
