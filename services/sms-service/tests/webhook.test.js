'use strict';

process.env.NODE_ENV = 'test';
process.env.SMS_PROVIDER = 'mock';
process.env.API_KEY = 'test-api-key-123';

const request = require('supertest');
const app = require('../app');

describe('Webhook endpoints', () => {
  it('should accept a twilio webhook (no real sig in test)', async () => {
    const res = await request(app)
      .post('/api/v1/webhooks/twilio')
      .send({ MessageSid: 'SM123', MessageStatus: 'delivered' });

    // Always 200 even if sig fails
    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);
  });

  it('should accept a vonage webhook', async () => {
    const res = await request(app)
      .post('/api/v1/webhooks/vonage')
      .send({ 'message-id': 'VN123', 'status': 'delivered' });

    expect(res.status).toBe(200);
  });

  it('should accept an unknown provider path 404', async () => {
    const res = await request(app).post('/api/v1/webhooks/nonexistent');
    expect(res.status).toBe(404);
  });
});
