import { HealthController } from './health.controller';

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(() => {
    controller = new HealthController();
  });

  it('should return health status', () => {
    const result = controller.check();
    expect(result.status).toBe('ok');
    expect(result.service).toBe('comms-service');
    expect(result.timestamp).toBeDefined();
    expect(result.uptime).toBeDefined();
    expect(typeof result.uptime).toBe('number');
  });
});
