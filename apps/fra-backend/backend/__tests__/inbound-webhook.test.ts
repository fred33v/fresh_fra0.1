/// <reference types="jest" />

import { afterEach, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import { app, authHeaders, createPaidUser } from './helpers';
import { signPayload } from '../src/webhooks-out';

const SECRET = 'test-inbound-secret';
const URL = 'http://localhost/api/v1/webhooks/assessment-submitted';

function send(body: string, signature?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (signature) headers['X-StopFRA-Signature'] = signature;
  return app.request(URL, { method: 'POST', headers, body });
}

describe('POST /webhooks/assessment-submitted', () => {
  let body: string;

  beforeAll(async () => {
    const user = await createPaidUser('pkg_full');
    const res = await app.request('http://localhost/api/v1/assessments', {
      method: 'POST',
      headers: authHeaders(user.accessToken),
      body: JSON.stringify({ title: 'Webhook test' }),
    });
    const assessment = ((await res.json()) as any).data;
    body = JSON.stringify({ assessmentId: assessment.id, organisationId: user.organisationId, source: 'n8n' });
  });

  beforeEach(() => { process.env.INBOUND_WEBHOOK_SECRET = SECRET; });
  afterEach(() => { delete process.env.INBOUND_WEBHOOK_SECRET; });

  it('is switched off when no secret is configured', async () => {
    delete process.env.INBOUND_WEBHOOK_SECRET;
    const res = await send(body, signPayload(SECRET, body));
    expect(res.status).toBe(404);
  });

  it('rejects unsigned requests', async () => {
    const res = await send(body);
    expect(res.status).toBe(401);
  });

  it('rejects a signature made with the wrong secret', async () => {
    const res = await send(body, signPayload('not-the-secret', body));
    expect(res.status).toBe(401);
  });

  it('rejects a signature for a different body', async () => {
    const res = await send(body, signPayload(SECRET, '{"assessmentId":"other"}'));
    expect(res.status).toBe(401);
  });

  it('rejects an old signature (replay)', async () => {
    const tenMinutesAgo = Math.floor(Date.now() / 1000) - 600;
    const res = await send(body, signPayload(SECRET, body, tenMinutesAgo));
    expect(res.status).toBe(401);
  });

  it('accepts a correctly signed request', async () => {
    const res = await send(body, signPayload(SECRET, body));
    expect(res.status).toBe(200);
    expect(((await res.json()) as any).data.status).toBe('received');
  });
});
