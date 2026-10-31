/// <reference types="jest" />

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { app } from './helpers';
import {
  browserFamily, scheduleClientErrorMetrics, scrubPage, scrubReport, scrubText, takePendingCount,
} from '../src/client-errors';

const URL_ = 'http://localhost/api/v1/client-errors';

function post(body: unknown) {
  return app.request(URL_, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36',
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

describe('scrubbing', () => {
  it('removes emails, JWTs, bearer tokens and long codes', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.abcdefghijk';
    const out = scrubText(`user jane.doe@example.co.uk failed with ${jwt}, Bearer abc.def, code KP7X9QW2ZL4M8N3B5V6C1D0F`);
    expect(out).not.toContain('jane.doe');
    expect(out).not.toContain(jwt);
    expect(out).not.toContain('abc.def');
    expect(out).not.toContain('KP7X9QW2ZL4M8N3B5V6C1D0F');
    expect(out).toContain('[email]');
    expect(out).toContain('[token]');
  });

  it('drops query strings from URLs in stack traces but keeps file and line', () => {
    const out = scrubText('at render (https://fraud-risk.co.uk/assets/index-Ab12Cd34.js?token=secret:1:2345)');
    expect(out).not.toContain('secret');
    expect(out).toContain('https://fraud-risk.co.uk/assets/index-Ab12Cd34.js');
  });

  it('keeps only the path of the page and hides speak-up tokens', () => {
    expect(scrubPage('https://fraud-risk.co.uk/auth?reset=abc123#x')).toBe('/auth');
    expect(scrubPage('/speak-up/Zx9_long-intake-token-value-1234')).toBe('/speak-up/[token]');
    expect(scrubPage('/speak-up/status')).toBe('/speak-up/status');
  });

  it('scrubs every field of a report', () => {
    const r = scrubReport({ source: 'react', message: 'a@b.com', stack: 'x@y.org', componentStack: 'c@d.net', page: '/join?code=1' });
    expect(JSON.stringify(r)).not.toMatch(/@/);
    expect(r.page).toBe('/join');
  });

  it('reduces the user agent to browser and major version', () => {
    expect(browserFamily('Mozilla/5.0 AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36')).toBe('Chrome 131');
    expect(browserFamily('Mozilla/5.0 AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0')).toBe('Edge 131');
    expect(browserFamily('Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 Version/18.1 Mobile/15E148 Safari/604.1')).toBe('Safari 18');
    expect(browserFamily('curl/8.0')).toBe('other');
  });
});

describe('POST /api/v1/client-errors', () => {
  let warn: any;
  beforeEach(() => {
    takePendingCount();
    warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => warn.mockRestore());

  it('accepts a report without sign-in, logs it scrubbed and counts it', async () => {
    const res = await post({
      source: 'error',
      message: 'TypeError: x is undefined for owner@acme.com',
      stack: 'at f (https://fraud-risk.co.uk/assets/index-Ab12Cd34.js:1:99)',
      page: 'https://fraud-risk.co.uk/employer?invite=XYZ',
      release: 'abc1234',
    });
    expect(res.status).toBe(204);
    expect(takePendingCount()).toBe(1);

    const line = warn.mock.calls.map((args: unknown[]) => String(args[0])).find((l: string) => l.includes('Frontend error'));
    expect(line).toBeDefined();
    const entry = JSON.parse(line!);
    expect(entry.context).toBe('client-error');
    expect(entry.data.page).toBe('/employer');
    expect(entry.data.browser).toBe('Chrome 131');
    expect(line).not.toContain('owner@acme.com');
    expect(line).not.toContain('XYZ');
  });

  it('clips very long fields instead of rejecting', async () => {
    const res = await post({ source: 'react', message: 'm'.repeat(5000), page: '/' });
    expect(res.status).toBe(204);
  });

  it('rejects malformed reports', async () => {
    expect((await post({ source: 'other', message: 'x', page: '/' })).status).toBe(400);
    expect((await post({ message: 'x' })).status).toBe(400);
    expect((await post('not json')).status).toBe(400);
  });
});

describe('scheduleClientErrorMetrics', () => {
  it('does nothing outside production or without a region', () => {
    expect(typeof scheduleClientErrorMetrics({ NODE_ENV: 'test', AWS_REGION: 'eu-north-1' })).toBe('function');
    expect(typeof scheduleClientErrorMetrics({ NODE_ENV: 'production' })).toBe('function');
  });
});
