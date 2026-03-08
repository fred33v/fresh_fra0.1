/// <reference types="jest" />

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

  it('extracts first IP from x-forwarded-for', () => {
    const c = mockContext({ 'x-forwarded-for': '1.2.3.4, 5.6.7.8' });
    expect(getClientIp(c)).toBe('1.2.3.4');
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
