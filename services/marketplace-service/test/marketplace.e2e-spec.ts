import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import * as crypto from 'crypto';
import { AppModule } from '../src/app.module';
import { ResponseTransformInterceptor } from '../src/common/interceptors/response-transform.interceptor';
import { Pool } from 'pg';

type AuthHeaderOptions = {
  userId: string;
  email: string;
  role: 'customer' | 'provider' | 'admin';
  providerId?: string;
  permissions?: string[];
};

function makeAuthHeaders(options: AuthHeaderOptions) {
  const permissions = options.permissions ?? [];
  const permissionsJson = JSON.stringify(permissions);
  const providerId = options.providerId ?? 'none';
  const secret =
    process.env.GATEWAY_INTERNAL_SECRET ??
    'dev-gateway-internal-secret-local-marketplace-2026';
  const payload = `${options.userId}:${options.email}:${options.role}:${providerId}:${permissionsJson}`;
  const hmac = crypto.createHmac('sha256', secret).update(payload).digest('hex');

  return {
    'x-user-id': options.userId,
    'x-user-email': options.email,
    'x-user-role': options.role,
    'x-user-permissions': permissionsJson,
    'x-gateway-hmac': hmac,
    ...(options.providerId ? { 'x-provider-id': options.providerId } : {}),
  };
}

describe('Marketplace Flow (e2e)', () => {
  let app: INestApplication;
  let pool: Pool;

  const customerEmail = `marketplace.e2e.customer.${Date.now()}@test.com`;
  const providerEmail = `marketplace.e2e.provider.${Date.now()}@test.com`;

  let previousProviderVerificationRequired: string | null = null;
  let categoryId: string;
  let customerId: string;
  let providerUserId: string;
  let providerId: string;
  let requestId: string;
  let requestDisplayId: string;
  let proposalId: string;
  let proposalDisplayId: string;
  let jobId: string;
  let jobDisplayId: string;

  const customerPermissions = [
    'requests.create',
    'proposals.accept',
    'requests.read',
    'jobs.read',
  ];

  const providerPermissions = [
    'proposals.create',
    'jobs.update_status',
    'proposals.read',
    'jobs.read',
  ];

  const customerHeaders = () =>
    makeAuthHeaders({
      userId: customerId,
      email: customerEmail,
      role: 'customer',
      permissions: customerPermissions,
    });

  const providerHeaders = () =>
    makeAuthHeaders({
      userId: providerUserId,
      email: providerEmail,
      role: 'provider',
      providerId,
      permissions: providerPermissions,
    });

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

    pool = app.get('DATABASE_POOL');

    const previousSetting = await pool.query(
      'SELECT value FROM system_settings WHERE key = $1',
      ['provider_verification_required'],
    );
    previousProviderVerificationRequired = previousSetting.rows[0]?.value ?? null;

    await pool.query(
      `INSERT INTO system_settings (key, value, description, type)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [
        'provider_verification_required',
        'false',
        'Disable provider verification for marketplace e2e tests',
        'boolean',
      ],
    );

    const categoryResult = await pool.query(
      `INSERT INTO service_categories (id, display_id, name, description)
       VALUES (gen_random_uuid(), $1, $2, $3)
       RETURNING id`,
      ['MCATTEST01', `Marketplace E2E Category ${Date.now()}`, 'Marketplace e2e category'],
    );
    categoryId = categoryResult.rows[0].id;

    const customerResult = await pool.query(
      `INSERT INTO users (id, display_id, email, password_hash, role, name)
       VALUES (gen_random_uuid(), $1, $2, $3, 'customer', $4)
       RETURNING id`,
      ['MCUSTE2E01', customerEmail, 'hashedpassword', 'Marketplace E2E Customer'],
    );
    customerId = customerResult.rows[0].id;

    const providerUserResult = await pool.query(
      `INSERT INTO users (id, display_id, email, password_hash, role, name)
       VALUES (gen_random_uuid(), $1, $2, $3, 'provider', $4)
       RETURNING id`,
      ['MPROVE2E01', providerEmail, 'hashedpassword', 'Marketplace E2E Provider'],
    );
    providerUserId = providerUserResult.rows[0].id;

    const providerResult = await pool.query(
      `INSERT INTO providers (id, display_id, user_id, business_name)
       VALUES (gen_random_uuid(), $1, $2, $3)
       RETURNING id`,
      ['MPRVE2E001', providerUserId, 'Marketplace E2E Plumbing'],
    );
    providerId = providerResult.rows[0].id;
  });

  afterAll(async () => {
    if (pool) {
      if (requestId) {
        await pool.query('DELETE FROM jobs WHERE request_id = $1', [requestId]).catch(() => {});
        await pool.query('DELETE FROM proposals WHERE request_id = $1', [requestId]).catch(() => {});
        await pool.query('DELETE FROM service_requests WHERE id = $1', [requestId]).catch(() => {});
      }

      await pool
        .query(
          `DELETE FROM locations WHERE address = $1 AND city = $2`,
          ['123 Test Street', 'Test City'],
        )
        .catch(() => {});

      if (providerId) {
        await pool.query('DELETE FROM providers WHERE id = $1', [providerId]).catch(() => {});
      }
      if (providerUserId) {
        await pool.query('DELETE FROM users WHERE id = $1', [providerUserId]).catch(() => {});
      }
      if (customerId) {
        await pool.query('DELETE FROM users WHERE id = $1', [customerId]).catch(() => {});
      }
      if (categoryId) {
        await pool.query('DELETE FROM service_categories WHERE id = $1', [categoryId]).catch(() => {});
      }

      if (previousProviderVerificationRequired === null) {
        await pool
          .query('DELETE FROM system_settings WHERE key = $1', [
            'provider_verification_required',
          ])
          .catch(() => {});
      } else {
        await pool
          .query('UPDATE system_settings SET value = $1 WHERE key = $2', [
            previousProviderVerificationRequired,
            'provider_verification_required',
          ])
          .catch(() => {});
      }
    }

    await app.close();
  });

  describe('Step 1: Create Service Request', () => {
    it('POST /requests should create a new request', async () => {
      const response = await request(app.getHttpServer())
        .post('/requests')
        .set(customerHeaders())
        .send({
          category_id: categoryId,
          description: 'Need a plumber to fix a leaking pipe in the kitchen urgently.',
          budget: 150,
          urgency: 'medium',
          location: {
            latitude: 12.9716,
            longitude: 77.5946,
            address: '123 Test Street',
            city: 'Test City',
            state: 'Test State',
            pincode: '560001',
            country: 'India',
          },
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      requestId = response.body.data.id;
      expect(requestId).toBeDefined();
      expect(response.body.data.category_id).toBe(categoryId);
      expect(response.body.data.description).toContain('leaking pipe');
    });

    it('POST /requests should fail without required fields', async () => {
      await request(app.getHttpServer())
        .post('/requests')
        .set(customerHeaders())
        .send({ description: 'Incomplete request' })
        .expect(400);
    });
  });

  describe('Step 2: Browse Requests', () => {
    it('GET /requests should list requests with pagination', async () => {
      const response = await request(app.getHttpServer())
        .get('/requests')
        .set(providerHeaders())
        .query({ limit: 10, page: 1 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.meta).toBeDefined();
    });

    it('GET /requests/:id should return the created request', async () => {
      const response = await request(app.getHttpServer())
        .get(`/requests/${requestId}`)
        .set(customerHeaders())
        .expect(200);

      expect(response.body.success).toBe(true);
      requestDisplayId = response.body.data.display_id;
      expect(response.body.data.id).toBe(requestId);
      expect(requestDisplayId).toBeDefined();
    });

    it('GET /requests/:id should accept display_id path values', async () => {
      const response = await request(app.getHttpServer())
        .get(`/requests/${requestDisplayId}`)
        .set(customerHeaders())
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(requestId);
    });

    it('GET /requests/:id should reject invalid id format', async () => {
      await request(app.getHttpServer())
        .get('/requests/not-a-valid-id')
        .set(customerHeaders())
        .expect(400);
    });

    it('GET /requests/my should return user requests', async () => {
      const response = await request(app.getHttpServer())
        .get('/requests/my')
        .set(customerHeaders())
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });

  describe('Step 3: Submit Proposal', () => {
    it('POST /requests/:requestId/proposals should create a proposal on the request', async () => {
      const response = await request(app.getHttpServer())
        .post(`/requests/${requestId}/proposals`)
        .set(providerHeaders())
        .send({
          price: 120,
          message: 'I can fix your leaking pipe. I have 10 years of plumbing experience.',
          estimated_hours: 2,
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      proposalId = response.body.data.id;
      proposalDisplayId = response.body.data.display_id;
      expect(response.body.data.request_id).toBe(requestId);
      expect(response.body.data.provider_id).toBe(providerId);
    });

    it('GET /requests/:requestId/proposals should list proposals for the request', async () => {
      const response = await request(app.getHttpServer())
        .get(`/requests/${requestId}/proposals`)
        .set(customerHeaders())
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('GET /proposals/my should return provider proposals', async () => {
      const response = await request(app.getHttpServer())
        .get('/proposals/my')
        .set(providerHeaders())
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('GET /proposals/:id should return the proposal', async () => {
      const response = await request(app.getHttpServer())
        .get(`/proposals/${proposalId}`)
        .set(providerHeaders())
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(proposalId);
      expect(response.body.data.display_id).toBe(proposalDisplayId);
    });

    it('GET /proposals/:id should accept display_id path values', async () => {
      const response = await request(app.getHttpServer())
        .get(`/proposals/${proposalDisplayId}`)
        .set(providerHeaders())
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(proposalId);
    });
  });

  describe('Step 4: Accept Proposal (creates Job)', () => {
    it('POST /proposals/:id/accept should create a job', async () => {
      const response = await request(app.getHttpServer())
        .post(`/proposals/${proposalId}/accept`)
        .set(customerHeaders())
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(proposalId);
      expect(response.body.data.status).toBe('accepted');

      const jobResult = await pool.query(
        'SELECT id, display_id FROM jobs WHERE request_id = $1',
        [requestId],
      );
      jobId = jobResult.rows[0]?.id;
      jobDisplayId = jobResult.rows[0]?.display_id;
      expect(jobId).toBeDefined();
    });
  });

  describe('Step 5: Manage Job', () => {
    it('GET /jobs/my should return user jobs', async () => {
      const response = await request(app.getHttpServer())
        .get('/jobs/my')
        .set(customerHeaders())
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('GET /jobs should list jobs with pagination', async () => {
      const response = await request(app.getHttpServer())
        .get('/jobs')
        .set(customerHeaders())
        .query({ limit: 10 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      if (!jobDisplayId) {
        const createdJob = response.body.data.find((job: any) => job.id === jobId);
        jobDisplayId = createdJob?.display_id;
      }
    });

    it('PATCH /jobs/:id/status should update job status', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/jobs/${jobId}/status`)
        .set(providerHeaders())
        .send({ status: 'in_progress' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('in_progress');
    });

    it('PATCH /jobs/:id/status should reject display_id path values', async () => {
      await request(app.getHttpServer())
        .patch(`/jobs/${jobDisplayId}/status`)
        .set(providerHeaders())
        .send({ status: 'in_progress' })
        .expect(400);
    });
  });

  describe('Step 6: Update Request', () => {
    it('PATCH /requests/:id should reject updates after the request is assigned', async () => {
      await request(app.getHttpServer())
        .patch(`/requests/${requestId}`)
        .set(customerHeaders())
        .send({ description: 'Updated: Need urgent plumbing fix' })
        .expect(400);
    });
  });
});