'use strict';

const MockProvider = require('../../src/providers/mock.provider');

describe('MockProvider', () => {
  let provider;

  beforeEach(() => {
    provider = new MockProvider({ successRate: 1 }); // Always succeed
  });

  it('should have name "mock"', () => {
    expect(provider.name).toBe('mock');
  });

  it('should send successfully and return messageId', async () => {
    const result = await provider.send({ to: '+919876543210', message: 'Test' });
    expect(result.success).toBe(true);
    expect(result.providerMessageId).toBeDefined();
    expect(result.status).toBe('SENT');
  });

  it('should fail with successRate=0', async () => {
    provider = new MockProvider({ successRate: 0 });
    const result = await provider.send({ to: '+919876543210', message: 'Test' });
    expect(result.success).toBe(false);
    expect(result.status).toBe('FAILED');
  });

  it('should return balance', async () => {
    const result = await provider.getBalance();
    expect(typeof result.balance).toBe('number');
  });

  it('validateWebhookSignature should resolve true in mock', async () => {
    const valid = await provider.validateWebhookSignature({}, 'any', {});
    expect(valid).toBe(true);
  });

  it('mapStatus should normalise known statuses', () => {
    expect(provider.mapStatus('delivered')).toBe('DELIVERED');
    expect(provider.mapStatus('sent')).toBe('SENT');
    expect(provider.mapStatus('failed')).toBe('FAILED');
    expect(provider.mapStatus('zzzz')).toBe('UNKNOWN');
  });
});
