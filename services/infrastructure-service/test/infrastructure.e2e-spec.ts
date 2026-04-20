import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import * as crypto from 'crypto';
import { AppModule } from '../src/app.module';
import { ResponseTransformInterceptor } from '../src/common/interceptors/response-transform.interceptor';

function makeAuthHeaders() {
  const permissions = [
    'infrastructure.events',
    'infrastructure.jobs',
    'infrastructure.rate_limits',
    'infrastructure.feature_flags',
  ];
  const permissionsJson = JSON.stringify(permissions);
  const secret =
    process.env.GATEWAY_INTERNAL_SECRET ??
    'dev-gateway-internal-secret-local-marketplace-2026';
  const userId = '00000000-0000-0000-0000-000000000001';
  const email = 'infra-e2e@test.local';
  const role = 'admin';
  const payload = `${userId}:${email}:${role}:none:${permissionsJson}`;
  const hmac = crypto.createHmac('sha256', secret).update(payload).digest('hex');

  return {
    'x-user-id': userId,
    'x-user-email': email,
    'x-user-role': role,
    'x-user-permissions': permissionsJson,
    'x-gateway-hmac': hmac,
  };
}

describe('InfrastructureController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalInterceptors(new ResponseTransformInterceptor());

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('/events (POST)', () => {
    it('should create an event', () => {
      return request(app.getHttpServer())
        .post('/events')
        .set(makeAuthHeaders())
        .send({
          eventType: 'user_created',
          payload: { userId: '123', email: 'test@example.com' },
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.statusCode).toBe(201);
          expect(res.body.data).toHaveProperty('id');
          expect(res.body.data).toHaveProperty('displayId');
        });
    });

    it('should reject invalid event data', () => {
      return request(app.getHttpServer())
        .post('/events')
        .set(makeAuthHeaders())
        .send({
          payload: { userId: '123' },
        })
        .expect(400);
    });
  });

  describe('/events (GET)', () => {
    it('should retrieve all events with pagination', () => {
      return request(app.getHttpServer())
        .get('/events?limit=10&offset=0')
        .set(makeAuthHeaders())
        .expect(200)
        .expect((res) => {
          expect(res.body.statusCode).toBe(200);
          expect(res.body.data).toBeInstanceOf(Array);
          expect(res.body.meta).toHaveProperty('total');
        });
    });
  });

  describe('/events/type/:eventType (GET)', () => {
    it('should retrieve events by type', () => {
      return request(app.getHttpServer())
        .get('/events/type/user_created')
        .set(makeAuthHeaders())
        .expect(200)
        .expect((res) => {
          expect(res.body.statusCode).toBe(200);
          expect(res.body.data).toBeInstanceOf(Array);
        });
    });
  });

  describe('/background-jobs (POST)', () => {
    it('should create a background job', () => {
      return request(app.getHttpServer())
        .post('/background-jobs')
        .set(makeAuthHeaders())
        .send({
          jobType: 'send-email',
          payload: { to: 'test@example.com', subject: 'Test Email' },
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.statusCode).toBe(201);
          expect(res.body.data).toHaveProperty('id');
            expect(res.body.data).toHaveProperty('displayId');
        });
    });
  });

  describe('/background-jobs (GET)', () => {
    it('should retrieve all background jobs', () => {
      return request(app.getHttpServer())
        .get('/background-jobs')
        .set(makeAuthHeaders())
        .expect(200)
        .expect((res) => {
          expect(res.body.statusCode).toBe(200);
          expect(res.body.data).toBeInstanceOf(Array);
          expect(res.body.meta).toHaveProperty('total');
        });
    });
  });

  describe('/background-jobs/status/:status (GET)', () => {
    it('should retrieve jobs by status', () => {
      return request(app.getHttpServer())
        .get('/background-jobs/status/pending')
        .set(makeAuthHeaders())
        .expect(200)
        .expect((res) => {
          expect(res.body.statusCode).toBe(200);
          expect(res.body.data).toBeInstanceOf(Array);
        });
    });
  });

  describe('/background-jobs/stats (GET)', () => {
    it('should retrieve queue statistics', () => {
      return request(app.getHttpServer())
        .get('/background-jobs/stats')
        .set(makeAuthHeaders())
        .expect(200)
        .expect((res) => {
          expect(res.body.statusCode).toBe(200);
          expect(res.body.data).toBeDefined();
        });
    });
  });

  describe('/rate-limits/check (POST)', () => {
    it('should check rate limit for a key', () => {
      return request(app.getHttpServer())
        .post('/rate-limits/check')
        .set(makeAuthHeaders())
        .send({ key: 'user:123' })
        .expect(200)
        .expect((res) => {
          expect(res.body.statusCode).toBe(200);
          expect(res.body.data).toHaveProperty('allowed');
          expect(res.body.data).toHaveProperty('remaining');
          expect(res.body.data).toHaveProperty('resetAt');
        });
    });

    it('should reject invalid rate limit check', () => {
      return request(app.getHttpServer())
        .post('/rate-limits/check')
        .set(makeAuthHeaders())
        .send({})
        .expect(400);
    });
  });

  describe('/rate-limits/:key (DELETE)', () => {
    it('should reset rate limit for a key', () => {
      return request(app.getHttpServer())
        .delete('/rate-limits/user:123')
        .set(makeAuthHeaders())
        .expect(200)
        .expect((res) => {
          expect(res.body.statusCode).toBe(200);
        });
    });
  });

  describe('/rate-limits/cleanup (POST)', () => {
    it('should cleanup expired rate limits', () => {
      return request(app.getHttpServer())
        .post('/rate-limits/cleanup')
        .set(makeAuthHeaders())
        .expect(200)
        .expect((res) => {
          expect(res.body.statusCode).toBe(200);
        });
    });
  });

  describe('/feature-flags (POST)', () => {
    it('should create a feature flag', () => {
      return request(app.getHttpServer())
        .post('/feature-flags')
        .set(makeAuthHeaders())
        .send({
          key: 'new_ui_enabled',
          enabled: true,
            rollout_percentage: 50,
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.statusCode).toBe(201);
          expect(res.body.data).toHaveProperty('key');
          expect(res.body.data.key).toBe('new_ui_enabled');
        });
    });

    it('should reject invalid feature flag data', () => {
      return request(app.getHttpServer())
        .post('/feature-flags')
        .set(makeAuthHeaders())
        .send({
          enabled: true,
        })
        .expect(400);
    });

    it('should reject invalid rollout percentage', () => {
      return request(app.getHttpServer())
        .post('/feature-flags')
        .set(makeAuthHeaders())
        .send({
          key: 'test_feature',
          enabled: true,
            rollout_percentage: 150,
        })
        .expect(400);
    });
  });

  describe('/feature-flags (GET)', () => {
    it('should retrieve all feature flags', () => {
      return request(app.getHttpServer())
        .get('/feature-flags')
        .set(makeAuthHeaders())
        .expect(200)
        .expect((res) => {
          expect(res.body.statusCode).toBe(200);
          expect(res.body.data).toBeInstanceOf(Array);
        });
    });
  });

  describe('/feature-flags/:key (GET)', () => {
    it('should retrieve feature flag by key', () => {
      return request(app.getHttpServer())
        .get('/feature-flags/new_ui_enabled')
        .set(makeAuthHeaders())
        .expect(200)
        .expect((res) => {
          expect(res.body.statusCode).toBe(200);
          expect(res.body.data).toBeDefined();
        });
    });
  });

  describe('/feature-flags/:key/enabled (GET)', () => {
    it('should check if feature is enabled', () => {
      return request(app.getHttpServer())
        .get('/feature-flags/new_ui_enabled/enabled')
        .set(makeAuthHeaders())
        .expect(200)
        .expect((res) => {
          expect(res.body.statusCode).toBe(200);
          expect(res.body.data).toHaveProperty('enabled');
          expect(typeof res.body.data.enabled).toBe('boolean');
        });
    });

    it('should check feature with userId for rollout', () => {
      return request(app.getHttpServer())
        .get('/feature-flags/new_ui_enabled/enabled?userId=user123')
        .set(makeAuthHeaders())
        .expect(200)
        .expect((res) => {
          expect(res.body.statusCode).toBe(200);
          expect(res.body.data).toHaveProperty('enabled');
        });
    });
  });

  describe('/feature-flags/:key (PATCH)', () => {
    it('should update feature flag', () => {
      return request(app.getHttpServer())
        .patch('/feature-flags/new_ui_enabled')
        .set(makeAuthHeaders())
        .send({ enabled: false })
        .expect(200)
        .expect((res) => {
          expect(res.body.statusCode).toBe(200);
        });
    });
  });

  describe('/feature-flags/:key (DELETE)', () => {
    it('should delete feature flag', () => {
      return request(app.getHttpServer())
        .delete('/feature-flags/new_ui_enabled')
        .set(makeAuthHeaders())
        .expect(200)
        .expect((res) => {
          expect(res.body.statusCode).toBe(200);
        });
    });
  });
});