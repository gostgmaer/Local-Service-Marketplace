import { Controller, Get, Inject, LoggerService } from "@nestjs/common";
import { WINSTON_MODULE_NEST_PROVIDER } from "nest-winston";
import { GatewayService } from "../services/gateway.service";

/**
 * ServicesHealthController — exposes GET /health/services
 *
 * Checks upstream microservice health by calling each service's /health endpoint.
 * The base GET /health route is handled by common/health/health.controller.ts
 * registered directly in AppModule, which also provides /health/metrics.
 */
@Controller("health")
export class ServicesHealthController {
  constructor(
    private readonly gatewayService: GatewayService,
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger: LoggerService,
  ) {}

  /**
   * Check all microservices health
   */
  @Get("services")
  async servicesHealthCheck(): Promise<any> {
    this.logger.log(
      "Services health check requested",
      "ServicesHealthController",
    );

    const servicesHealth = await this.gatewayService.healthCheck();
    const downServices = Object.entries(servicesHealth)
      .filter(([, service]) => (service as any).status !== "ok")
      .map(([serviceName]) => serviceName);

    return {
      status: downServices.length === 0 ? "ok" : "down",
      timestamp: new Date().toISOString(),
      services: servicesHealth,
      summary: {
        total: Object.keys(servicesHealth).length,
        ok: Object.keys(servicesHealth).length - downServices.length,
        down: downServices.length,
        downServices,
      },
    };
  }
}
