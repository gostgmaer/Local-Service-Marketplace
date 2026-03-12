import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { Pool } from 'pg';

describe('MessagingController (e2e)', () => {
  let app: INestApplication;
  let pool: Pool;
  let messageId: string;
  let attachmentId: string;
  let testJobId: string;
  let testUserId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
    app.useGlobalFilters(new HttpExceptionFilter(app.get('WINSTON_MODULE_NEST_PROVIDER')));
    await app.init();

    pool = app.get('DATABASE_POOL');

    // Create test job and user IDs (in a real scenario, these would be created by other services)
    const jobResult = await pool.query(
      'INSERT INTO jobs (id, request_id, proposal_id, status, created_at) VALUES (gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), $1, NOW()) RETURNING id',
      ['active'],
    );
    testJobId = jobResult.rows[0].id;

    const userResult = await pool.query(
      'INSERT INTO users (id, email, password_hash, first_name, last_name, role, created_at) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, NOW()) RETURNING id',
      ['test@example.com', 'hash123', 'John', 'Doe', 'user'],
    );
    testUserId = userResult.rows[0].id;
  });

  afterAll(async () => {
    // Clean up test data
    if (messageId) {
      await pool.query('DELETE FROM messages WHERE id = $1', [messageId]);
    }
    if (attachmentId) {
      await pool.query('DELETE FROM attachments WHERE id = $1', [attachmentId]);
    }
    if (testJobId) {
      await pool.query('DELETE FROM messages WHERE job_id = $1', [testJobId]);
      await pool.query('DELETE FROM jobs WHERE id = $1', [testJobId]);
    }
    if (testUserId) {
      await pool.query('DELETE FROM users WHERE id = $1', [testUserId]);
    }
    await pool.end();
    await app.close();
  });

  describe('POST /messages', () => {
    it('should create a message', async () => {
      const response = await request(app.getHttpServer())
        .post('/messages')
        .send({
          jobId: testJobId,
          senderId: testUserId,
          message: 'Hello, this is a test message',
        })
        .expect(201);

      expect(response.body.message).toBeDefined();
      expect(response.body.message.id).toBeDefined();
      expect(response.body.message.jobId).toBe(testJobId);
      expect(response.body.message.senderId).toBe(testUserId);
      expect(response.body.message.message).toBe('Hello, this is a test message');
      expect(response.body.message.createdAt).toBeDefined();
      messageId = response.body.message.id;
    });

    it('should fail with invalid job id', async () => {
      await request(app.getHttpServer())
        .post('/messages')
        .send({
          jobId: 'invalid-uuid',
          senderId: testUserId,
          message: 'Test message',
        })
        .expect(400);
    });

    it('should fail with empty message', async () => {
      await request(app.getHttpServer())
        .post('/messages')
        .send({
          jobId: testJobId,
          senderId: testUserId,
          message: '',
        })
        .expect(400);
    });
  });

  describe('GET /messages/:id', () => {
    it('should retrieve a message by id', async () => {
      const response = await request(app.getHttpServer())
        .get(`/messages/${messageId}`)
        .expect(200);

      expect(response.body.message).toBeDefined();
      expect(response.body.message.id).toBe(messageId);
      expect(response.body.message.jobId).toBe(testJobId);
    });

    it('should return 404 for non-existent message', async () => {
      await request(app.getHttpServer())
        .get(`/messages/00000000-0000-0000-0000-000000000000`)
        .expect(404);
    });
  });

  describe('GET /messages/jobs/:jobId/messages', () => {
    beforeAll(async () => {
      // Create additional test messages
      for (let i = 0; i < 5; i++) {
        await request(app.getHttpServer())
          .post('/messages')
          .send({
            jobId: testJobId,
            senderId: testUserId,
            message: `Test message ${i + 1}`,
          });
      }
    });

    it('should retrieve messages for a job with pagination', async () => {
      const response = await request(app.getHttpServer())
        .get(`/messages/jobs/${testJobId}/messages`)
        .query({ page: 1, limit: 3 })
        .expect(200);

      expect(response.body.data).toBeDefined();
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeLessThanOrEqual(3);
      expect(response.body.total).toBeGreaterThan(0);
      expect(response.body.page).toBe(1);
      expect(response.body.limit).toBe(3);
      expect(response.body.hasMore).toBeDefined();
    });

    it('should retrieve messages with default pagination', async () => {
      const response = await request(app.getHttpServer())
        .get(`/messages/jobs/${testJobId}/messages`)
        .expect(200);

      expect(response.body.data).toBeDefined();
      expect(response.body.page).toBe(1);
      expect(response.body.limit).toBe(20);
    });

    it('should retrieve second page of messages', async () => {
      const response = await request(app.getHttpServer())
        .get(`/messages/jobs/${testJobId}/messages`)
        .query({ page: 2, limit: 3 })
        .expect(200);

      expect(response.body.data).toBeDefined();
      expect(response.body.page).toBe(2);
    });
  });

  describe('POST /messages/attachments', () => {
    it('should create an attachment', async () => {
      const response = await request(app.getHttpServer())
        .post('/messages/attachments')
        .send({
          entityType: 'message',
          entityId: messageId,
          fileUrl: 'https://example.com/files/test.pdf',
        })
        .expect(201);

      expect(response.body.attachment).toBeDefined();
      expect(response.body.attachment.id).toBeDefined();
      expect(response.body.attachment.entityType).toBe('message');
      expect(response.body.attachment.entityId).toBe(messageId);
      expect(response.body.attachment.fileUrl).toBe('https://example.com/files/test.pdf');
      attachmentId = response.body.attachment.id;
    });

    it('should fail with invalid URL', async () => {
      await request(app.getHttpServer())
        .post('/messages/attachments')
        .send({
          entityType: 'message',
          entityId: messageId,
          fileUrl: 'not-a-valid-url',
        })
        .expect(400);
    });

    it('should fail with invalid entity id', async () => {
      await request(app.getHttpServer())
        .post('/messages/attachments')
        .send({
          entityType: 'message',
          entityId: 'invalid-uuid',
          fileUrl: 'https://example.com/files/test.pdf',
        })
        .expect(400);
    });
  });

  describe('GET /messages/attachments/:id', () => {
    it('should retrieve an attachment by id', async () => {
      const response = await request(app.getHttpServer())
        .get(`/messages/attachments/${attachmentId}`)
        .expect(200);

      expect(response.body.attachment).toBeDefined();
      expect(response.body.attachment.id).toBe(attachmentId);
      expect(response.body.attachment.entityType).toBe('message');
    });

    it('should return 404 for non-existent attachment', async () => {
      await request(app.getHttpServer())
        .get(`/messages/attachments/00000000-0000-0000-0000-000000000000`)
        .expect(404);
    });
  });

  describe('GET /messages/attachments/:entityType/:entityId', () => {
    it('should retrieve attachments by entity', async () => {
      const response = await request(app.getHttpServer())
        .get(`/messages/attachments/message/${messageId}`)
        .expect(200);

      expect(response.body.attachments).toBeDefined();
      expect(Array.isArray(response.body.attachments)).toBe(true);
      expect(response.body.attachments.length).toBeGreaterThan(0);
    });
  });
});
