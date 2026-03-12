import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('AnalyticsController (e2e)', () => {
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

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('/analytics/activity (POST)', () => {
    it('should track user activity', () => {
      return request(app.getHttpServer())
        .post('/analytics/activity')
        .send({
          userId: '123e4567-e89b-12d3-a456-426614174000',
          action: 'login',
          metadata: { device: 'mobile' },
          ipAddress: '192.168.1.1',
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.statusCode).toBe(201);
          expect(res.body.message).toBe('Activity tracked successfully');
          expect(res.body.data).toHaveProperty('id');
          expect(res.body.data.userId).toBe('123e4567-e89b-12d3-a456-426614174000');
          expect(res.body.data.action).toBe('login');
        });
    });

    it('should reject invalid userId format', () => {
      return request(app.getHttpServer())
        .post('/analytics/activity')
        .send({
          userId: 'invalid-uuid',
          action: 'login',
        })
        .expect(400);
    });

    it('should reject missing required fields', () => {
      return request(app.getHttpServer())
        .post('/analytics/activity')
        .send({
          userId: '123e4567-e89b-12d3-a456-426614174000',
        })
        .expect(400);
    });
  });

  describe('/analytics/user-activity (GET)', () => {
    it('should retrieve all user activity logs', () => {
      return request(app.getHttpServer())
        .get('/analytics/user-activity')
        .expect(200)
        .expect((res) => {
          expect(res.body.statusCode).toBe(200);
          expect(res.body.message).toBe('Activity logs retrieved successfully');
          expect(res.body.data).toBeInstanceOf(Array);
          expect(res.body.pagination).toHaveProperty('total');
        });
    });

    it('should support pagination with limit and offset', () => {
      return request(app.getHttpServer())
        .get('/analytics/user-activity?limit=10&offset=0')
        .expect(200)
        .expect((res) => {
          expect(res.body.pagination.limit).toBe(10);
          expect(res.body.pagination.offset).toBe(0);
        });
    });
  });

  describe('/analytics/user-activity/:userId (GET)', () => {
    it('should retrieve activity for a specific user', () => {
      const userId = '123e4567-e89b-12d3-a456-426614174000';
      
      return request(app.getHttpServer())
        .get(`/analytics/user-activity/${userId}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.statusCode).toBe(200);
          expect(res.body.message).toBe('User activity retrieved successfully');
          expect(res.body.data).toBeInstanceOf(Array);
        });
    });
  });

  describe('/analytics/user-activity/action/:action (GET)', () => {
    it('should retrieve activity logs by action', () => {
      return request(app.getHttpServer())
        .get('/analytics/user-activity/action/login')
        .expect(200)
        .expect((res) => {
          expect(res.body.statusCode).toBe(200);
          expect(res.body.data).toBeInstanceOf(Array);
        });
    });
  });

  describe('/analytics/metrics (GET)', () => {
    it('should retrieve daily metrics', () => {
      return request(app.getHttpServer())
        .get('/analytics/metrics')
        .expect(200)
        .expect((res) => {
          expect(res.body.statusCode).toBe(200);
          expect(res.body.message).toBe('Daily metrics retrieved successfully');
          expect(res.body.data).toBeInstanceOf(Array);
        });
    });

    it('should support date range filtering', () => {
      return request(app.getHttpServer())
        .get('/analytics/metrics?startDate=2024-01-01&endDate=2024-01-31')
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toBeInstanceOf(Array);
        });
    });

    it('should support limit parameter', () => {
      return request(app.getHttpServer())
        .get('/analytics/metrics?limit=7')
        .expect(200);
    });
  });

  describe('/analytics/metrics/:date (GET)', () => {
    it('should retrieve metric for a specific date', () => {
      const date = '2024-01-01';
      
      return request(app.getHttpServer())
        .get(`/analytics/metrics/${date}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.statusCode).toBe(200);
          expect(res.body.message).toBe('Metric retrieved successfully');
        });
    });
  });

  describe('/analytics/workers/aggregate-today (POST)', () => {
    it('should trigger today metrics aggregation', () => {
      return request(app.getHttpServer())
        .post('/analytics/workers/aggregate-today')
        .expect(200)
        .expect((res) => {
          expect(res.body.statusCode).toBe(200);
          expect(res.body.message).toBe('Today metrics aggregated successfully');
          expect(res.body.data).toHaveProperty('date');
          expect(res.body.data).toHaveProperty('totalUsers');
        });
    });
  });

  describe('/analytics/workers/aggregate-yesterday (POST)', () => {
    it('should trigger yesterday metrics aggregation', () => {
      return request(app.getHttpServer())
        .post('/analytics/workers/aggregate-yesterday')
        .expect(200)
        .expect((res) => {
          expect(res.body.statusCode).toBe(200);
          expect(res.body.message).toBe('Yesterday metrics aggregated successfully');
        });
    });
  });

  describe('/analytics/workers/aggregate/:date (POST)', () => {
    it('should trigger metrics aggregation for specific date', () => {
      const date = '2024-01-01';
      
      return request(app.getHttpServer())
        .post(`/analytics/workers/aggregate/${date}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.statusCode).toBe(200);
          expect(res.body.message).toBe(`Metrics aggregated successfully for ${date}`);
        });
    });
  });

  describe('/analytics/workers/backfill (POST)', () => {
    it('should backfill metrics for date range', () => {
      return request(app.getHttpServer())
        .post('/analytics/workers/backfill')
        .send({
          startDate: '2024-01-01',
          endDate: '2024-01-07',
        })
        .expect(200)
        .expect((res) => {
          expect(res.body.statusCode).toBe(200);
          expect(res.body.data).toBeInstanceOf(Array);
        });
    });
  });
});
