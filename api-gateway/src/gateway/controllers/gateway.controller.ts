import {
  Controller,
  All,
  Req,
  Res,
  Param,
  Inject,
  LoggerService,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { GatewayService } from '../services/gateway.service';

@Controller()
export class GatewayController {
  constructor(
    private readonly gatewayService: GatewayService,
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger: LoggerService,
  ) {}

  /**
   * Catch-all route handler
   * Forwards all requests to appropriate microservices
   */
  @All('*')
  async handleRequest(
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    try {
      const { method, path, body, headers, query } = req;

      this.logger.log(
        `Gateway received ${method} ${path}`,
        'GatewayController',
      );

      // Forward request to microservice
      const response = await this.gatewayService.forwardRequest(
        path,
        method,
        body,
        headers,
        query,
      );

      // Forward response headers from microservice
      if (response.headers) {
        Object.keys(response.headers).forEach((key) => {
          // Skip certain headers that shouldn't be forwarded
          if (
            ![
              'content-encoding',
              'transfer-encoding',
              'connection',
              'keep-alive',
            ].includes(key.toLowerCase())
          ) {
            res.setHeader(key, response.headers[key]);
          }
        });
      }

      // Send response from microservice
      res.status(response.status).json(response.data);
    } catch (error) {
      this.logger.error(
        `Gateway error: ${error.message}`,
        error.stack,
        'GatewayController',
      );

      // Handle error responses
      const status = error.status || 500;
      const message =
        error.response?.message || error.message || 'Internal server error';

      res.status(status).json({
        statusCode: status,
        message,
        timestamp: new Date().toISOString(),
        path: req.path,
      });
    }
  }
}
