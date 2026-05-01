import { Controller, Get, Header } from "@nestjs/common";
import { MetricsInterceptor } from "../interceptors/metrics.interceptor";
import { GatewayService } from "../../gateway/services/gateway.service";

@Controller("health")
export class HealthController {
  constructor(private readonly gatewayService: GatewayService) {}

  @Get()
  async check() {
    const services = await this.gatewayService.healthCheck();
    const downServices = Object.entries(services)
      .filter(([, service]) => (service as any).status !== "ok")
      .map(([serviceName]) => serviceName);

    return {
      status: downServices.length === 0 ? "ok" : "down",
      gateway: "api-gateway",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      services,
      summary: {
        total: Object.keys(services).length,
        ok: Object.keys(services).length - downServices.length,
        down: downServices.length,
        downServices,
      },
    };
  }

  @Get("metrics")
  getMetrics() {
    return MetricsInterceptor.getMetrics();
  }

  @Get("metrics/prometheus")
  @Header("Content-Type", "text/plain; version=0.0.4")
  getPrometheusMetrics(): string {
    return MetricsInterceptor.toPrometheus();
  }
}
