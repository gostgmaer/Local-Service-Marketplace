'use strict';

process.env.NODE_ENV = 'test';
process.env.SMS_PROVIDER = 'mock';
process.env.API_KEY = 'test-api-key-123';
process.env.MONGODB_URI = 'mongodb://localhost:27017/sms-test';

const request = require('supertest');
const app = require('../app');

describe('SMS Endpoints', () => {
  const AUTH = { Authorization: 'Bearer test-api-key-123' };

  describe('POST /api/v1/sms/send', () => {
    it('should send an SMS successfully', async () => {
      const res = await request(app)
        .post('/api/v1/sms/send')
        .set(AUTH)
        .send({ to: '+919876543210', message: 'Hello from tests' });

      expect(res.status).toBe(202);
      expect(res.body.success).toBe(true);
      expect(res.body.data.messageId).toBeDefined();
      expect(res.body.data.status).toMatch(/SENT|QUEUED/);
    });

    it('should reject invalid phone number', async () => {
      const res = await request(app)
        .post('/api/v1/sms/send')
        .set(AUTH)
        .send({ to: '123', message: 'Test' });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
    });

    it('should reject missing message', async () => {
      const res = await request(app)
        .post('/api/v1/sms/send')
        .set(AUTH)
        .send({ to: '+919876543210' });

      expect(res.status).toBe(422);
    });

    it('should reject unauthenticated request', async () => {
      const res = await request(app)
        .post('/api/v1/sms/send')
        .send({ to: '+919876543210', message: 'Test' });

      expect(res.status).toBe(401);
    });

    it('returns existing log on duplicate referenceId', async () => {
      const body = { to: '+919876543210', message: 'Idempotency test', referenceId: 'idem-001' };
      const r1 = await request(app).post('/api/v1/sms/send').set(AUTH).send(body);
      const r2 = await request(app).post('/api/v1/sms/send').set(AUTH).send(body);
      expect(r1.body.data.messageId).toBe(r2.body.data.messageId);
    });
  });

  describe('POST /api/v1/sms/send-otp', () => {
    it('should send OTP and not expose OTP value', async () => {
      const res = await request(app)
        .post('/api/v1/sms/send-otp')
        .set(AUTH)
        .send({ to: '+919876543210' });

      expect(res.status).toBe(202);
      expect(res.body.data.otp).toBeUndefined();
      expect(res.body.data.referenceId).toBeDefined();
      expect(res.body.data.expiresAt).toBeDefined();
    });
  });

  describe('GET /api/v1/sms/:messageId', () => {
    it('should return message details', async () => {
      const send = await request(app)
        .post('/api/v1/sms/send')
        .set(AUTH)
        .send({ to: '+919876543210', message: 'Fetch test' });

      const messageId = send.body.data.messageId;
      const res = await request(app).get(`/api/v1/sms/${messageId}`).set(AUTH);
      expect(res.status).toBe(200);
      expect(res.body.data.messageId).toBe(messageId);
    });

    it('should 404 for unknown messageId', async () => {
      const res = await request(app).get('/api/v1/sms/not-a-real-id').set(AUTH);
      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/v1/sms', () => {
    it('should list messages with pagination', async () => {
      await request(app).post('/api/v1/sms/send').set(AUTH).send({ to: '+919876543210', message: 'List test 1' });
      await request(app).post('/api/v1/sms/send').set(AUTH).send({ to: '+919876543210', message: 'List test 2' });

      const res = await request(app).get('/api/v1/sms?limit=10').set(AUTH);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.pagination).toBeDefined();
    });
  });

  describe('GET /api/v1/health', () => {
    it('should return ok', async () => {
      const res = await request(app).get('/api/v1/health');
      expect([200, 503]).toContain(res.status);
      expect(res.body.status).toBeDefined();
    });
  });
});
