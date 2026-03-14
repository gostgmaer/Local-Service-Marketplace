'use strict';

process.env.NODE_ENV = 'test';
process.env.SMS_PROVIDER = 'mock';
process.env.API_KEY = 'test-api-key-123';

const request = require('supertest');
const app = require('../app');

const AUTH = { Authorization: 'Bearer test-api-key-123' };

describe('Bulk SMS', () => {
  it('should create a campaign and return campaignId', async () => {
    const res = await request(app)
      .post('/api/v1/sms/send-bulk')
      .set(AUTH)
      .send({
        recipients: [
          { to: '+919876543210' },
          { to: '+919876543211' },
        ],
        message: 'Bulk test message',
        messageType: 'PROMOTIONAL',
      });

    expect(res.status).toBe(202);
    expect(res.body.success).toBe(true);
    expect(res.body.data.campaignId).toBeDefined();
    expect(res.body.data.totalCount).toBe(2);
    expect(res.body.data.status).toBe('RUNNING');
  });

  it('should reject bulk send with no recipients', async () => {
    const res = await request(app)
      .post('/api/v1/sms/send-bulk')
      .set(AUTH)
      .send({ recipients: [], message: 'Test' });

    expect(res.status).toBe(422);
  });

  it('should reject bulk send with no message and no templateId', async () => {
    const res = await request(app)
      .post('/api/v1/sms/send-bulk')
      .set(AUTH)
      .send({ recipients: [{ to: '+919876543210' }] });

    expect(res.status).toBe(422);
  });
});
