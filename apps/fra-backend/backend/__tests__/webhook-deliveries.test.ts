import { describe, it, expect } from '@jest/globals';
import { deliveryOutcome, drainWebhookDeliveries } from '../src/webhook-deliveries';
describe('persisted webhook retry policy', () => {
  it.each([200, 201, 204, 299])('accepts HTTP %s', (status) =>
    expect(deliveryOutcome(status, 1)).toEqual({ status: 'delivered', delayMs: 0 })
  );
  it.each([400, 401, 403, 404, 410, 422])('dead-letters HTTP %s', (status) =>
    expect(deliveryOutcome(status, 1).status).toBe('dead')
  );
  it.each([0, 302, 429, 500, 503])(
    'retries transient HTTP/network %s on the persisted schedule',
    (status) => {
      expect([1, 2, 3, 4].map((attempt) => deliveryOutcome(status, attempt))).toEqual([
        { status: 'pending', delayMs: 1000 },
        { status: 'pending', delayMs: 10000 },
        { status: 'pending', delayMs: 60000 },
        { status: 'dead', delayMs: 0 },
      ]);
    }
  );
  it('uses the existing immediate memory-mode delivery without creating a database worker', async () =>
    expect(await drainWebhookDeliveries()).toBe(0));
});
