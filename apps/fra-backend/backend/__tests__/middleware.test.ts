/// <reference types="jest" />

import { beforeAll, afterAll, beforeEach, afterEach, describe, expect, it, jest } from '@jest/globals';
import {
  stripProtoPollution,
  sanitizeString,
  sanitizeObject,
  getClientIp,
} from '../src/middleware';

// ── stripProtoPollution ────────────────────────────────────────

describe('stripProtoPollution', () => {
  it('removes __proto__ keys', () => {
    const input = JSON.parse('{"name":"safe","__proto__":{"admin":true}}');
    const result = stripProtoPollution(input) as Record<string, unknown>;
    expect(result).toEqual({ name: 'safe' });
    expect(result).not.toHaveProperty('__proto__', { admin: true });
  });

  it('removes constructor keys', () => {
    const input = { name: 'safe', constructor: { prototype: { isAdmin: true } } };
    const result = stripProtoPollution(input) as Record<string, unknown>;
    expect(result).toEqual({ name: 'safe' });
  });

  it('removes prototype keys', () => {
    const input = { name: 'safe', prototype: { exec: 'evil' } };
    const result = stripProtoPollution(input) as Record<string, unknown>;
    expect(result).toEqual({ name: 'safe' });
  });

  it('recursively strips nested pollution', () => {
    const input = JSON.parse('{"data":{"__proto__":{"admin":true},"value":"ok"}}');
    const result = stripProtoPollution(input) as Record<string, unknown>;
    expect(result).toEqual({ data: { value: 'ok' } });
  });

  it('handles arrays', () => {
    const input = [{ safe: true }, JSON.parse('{"__proto__":{"x":1},"ok":1}')];
    const result = stripProtoPollution(input) as unknown[];
    expect(result).toEqual([{ safe: true }, { ok: 1 }]);
  });

  it('passes through null', () => {
    expect(stripProtoPollution(null)).toBeNull();
  });

  it('passes through primitives', () => {
    expect(stripProtoPollution('hello')).toBe('hello');
    expect(stripProtoPollution(42)).toBe(42);
    expect(stripProtoPollution(true)).toBe(true);
    expect(stripProtoPollution(undefined)).toBeUndefined();
  });

  it('handles empty objects', () => {
    expect(stripProtoPollution({})).toEqual({});
  });

  it('handles deeply nested pollution', () => {
    const input = JSON.parse('{"a":{"b":{"c":{"__proto__":{"x":1},"safe":"yes"}}}}');
    const result = stripProtoPollution(input);
    expect(result).toEqual({ a: { b: { c: { safe: 'yes' } } } });
  });
});

// ── sanitizeString ─────────────────────────────────────────────

describe('sanitizeString', () => {
  it('escapes < and > to HTML entities', () => {
    expect(sanitizeString('<script>alert("xss")</script>')).toBe(
      '&lt;script&gt;alert("xss")&lt;/script&gt;'
    );
  });

  it('removes javascript: protocol', () => {
    expect(sanitizeString('javascript:alert(1)')).toBe('alert(1)');
  });

  it('removes javascript: case-insensitively', () => {
    expect(sanitizeString('JavaScript:alert(1)')).toBe('alert(1)');
    expect(sanitizeString('JAVASCRIPT:alert(1)')).toBe('alert(1)');
  });

  it('strips inline event handlers', () => {
    expect(sanitizeString('onclick=alert(1)')).not.toContain('onclick=');
    expect(sanitizeString('onerror =alert(1)')).not.toContain('onerror');
    expect(sanitizeString('onmouseover=evil()')).not.toContain('onmouseover=');
  });

  it('leaves safe strings unchanged', () => {
    expect(sanitizeString('Hello World')).toBe('Hello World');
    expect(sanitizeString('user@example.com')).toBe('user@example.com');
    expect(sanitizeString('Price: £49.99')).toBe('Price: £49.99');
  });

  it('handles empty string', () => {
    expect(sanitizeString('')).toBe('');
  });

  it('handles mixed malicious content', () => {
    const input = '<img onerror=alert(1) src="javascript:void(0)">';
    const result = sanitizeString(input);
    expect(result).not.toContain('<img');
    expect(result).not.toContain('onerror');
    expect(result).not.toContain('javascript:');
  });
});

// ── sanitizeObject ─────────────────────────────────────────────

describe('sanitizeObject', () => {
  it('sanitizes string values in objects', () => {
    const input = { name: '<b>bold</b>', age: 30 };
    const result = sanitizeObject(input) as Record<string, unknown>;
    expect(result.name).toBe('&lt;b&gt;bold&lt;/b&gt;');
    expect(result.age).toBe(30);
  });

  it('recursively sanitizes nested objects', () => {
    const input = { user: { bio: '<script>x</script>' } };
    const result = sanitizeObject(input) as any;
    expect(result.user.bio).toBe('&lt;script&gt;x&lt;/script&gt;');
  });

  it('sanitizes arrays of strings', () => {
    const input = ['<b>one</b>', '<i>two</i>'];
    const result = sanitizeObject(input) as string[];
    expect(result).toEqual(['&lt;b&gt;one&lt;/b&gt;', '&lt;i&gt;two&lt;/i&gt;']);
  });

  it('sanitizes strings inside arrays of objects', () => {
    const input = [{ name: '<script>x</script>' }];
    const result = sanitizeObject(input) as any[];
    expect(result[0].name).toBe('&lt;script&gt;x&lt;/script&gt;');
  });

  it('passes through null', () => {
    expect(sanitizeObject(null)).toBeNull();
  });

  it('passes through numbers and booleans', () => {
    expect(sanitizeObject(42)).toBe(42);
    expect(sanitizeObject(true)).toBe(true);
  });

  it('sanitizes a plain string', () => {
    expect(sanitizeObject('<div>test</div>')).toBe('&lt;div&gt;test&lt;/div&gt;');
  });

  it('handles mixed nested structures', () => {
    const input = {
      items: [
        { title: '<script>xss</script>', count: 5 },
        { title: 'Safe title', count: 10 },
      ],
      meta: null,
    };
    const result = sanitizeObject(input) as any;
    expect(result.items[0].title).toBe('&lt;script&gt;xss&lt;/script&gt;');
    expect(result.items[0].count).toBe(5);
    expect(result.items[1].title).toBe('Safe title');
    expect(result.meta).toBeNull();
  });
});

// ── getClientIp ────────────────────────────────────────────────

describe('getClientIp', () => {
  function mockContext(headers: Record<string, string | undefined>) {
    return {
      req: {
        header: (name: string) => headers[name.toLowerCase()],
      },
    } as any;
  }

  afterEach(() => {
    delete process.env.TRUSTED_PROXY_COUNT;
  });

  it('uses the address added by the proxy, not one the client sent', () => {
    // Client sent "1.2.3.4"; the load balancer appended the real address 5.6.7.8
    const c = mockContext({ 'x-forwarded-for': '1.2.3.4, 5.6.7.8' });
    expect(getClientIp(c)).toBe('5.6.7.8');
  });

  it('cannot be spoofed by prepending fake addresses', () => {
    const real = mockContext({ 'x-forwarded-for': '5.6.7.8' });
    const spoofed = mockContext({ 'x-forwarded-for': '9.9.9.9, 8.8.8.8, 5.6.7.8' });
    expect(getClientIp(spoofed)).toBe(getClientIp(real));
  });

  it('counts back past each trusted proxy when TRUSTED_PROXY_COUNT is set', () => {
    process.env.TRUSTED_PROXY_COUNT = '2';
    // fake, real client (added by the load balancer), load balancer (added by nginx)
    const c = mockContext({ 'x-forwarded-for': '9.9.9.9, 5.6.7.8, 10.0.1.20' });
    expect(getClientIp(c)).toBe('5.6.7.8');
  });

  it('uses the left-most entry when there are fewer hops than trusted proxies', () => {
    process.env.TRUSTED_PROXY_COUNT = '3';
    const c = mockContext({ 'x-forwarded-for': '5.6.7.8, 10.0.1.20' });
    expect(getClientIp(c)).toBe('5.6.7.8');
  });

  it('trims whitespace from x-forwarded-for', () => {
    const c = mockContext({ 'x-forwarded-for': '  10.0.0.1  ' });
    expect(getClientIp(c)).toBe('10.0.0.1');
  });

  it('falls back to x-real-ip', () => {
    const c = mockContext({ 'x-real-ip': '192.168.1.1' });
    expect(getClientIp(c)).toBe('192.168.1.1');
  });

  it('trims whitespace from x-real-ip', () => {
    const c = mockContext({ 'x-real-ip': '  192.168.1.1  ' });
    expect(getClientIp(c)).toBe('192.168.1.1');
  });

  it('returns unknown when no IP headers present', () => {
    const c = mockContext({});
    expect(getClientIp(c)).toBe('unknown');
  });

  it('prefers x-forwarded-for over x-real-ip', () => {
    const c = mockContext({
      'x-forwarded-for': '1.1.1.1',
      'x-real-ip': '2.2.2.2',
    });
    expect(getClientIp(c)).toBe('1.1.1.1');
  });
});

// ── Request body size limit ────────────────────────────────────

describe('request body size limit', () => {
  // Imported here so the app picks up the middleware under test
  const big = 'x'.repeat(1_048_576 + 10);

  it('rejects an oversized body that declares its length', async () => {
    const { app } = await import('./helpers');
    const res = await app.request('http://localhost/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'a@example.com', password: big }),
    });
    expect(res.status).toBe(413);
  });

  it('rejects an oversized chunked body with no Content-Length', async () => {
    const { app } = await import('./helpers');
    const chunk = new TextEncoder().encode(big);
    const stream = new ReadableStream({
      start(controller) { controller.enqueue(chunk); controller.close(); },
    });
    const res = await app.request('http://localhost/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: stream,
      duplex: 'half', // required by Node for streamed request bodies
    });
    expect(res.status).toBe(413);
  });
});
