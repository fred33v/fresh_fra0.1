import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { EventEmitter } from 'node:events';
import type { ClientRequest, IncomingMessage } from 'node:http';
import type { RequestOptions } from 'node:https';
import type { LookupAddress } from 'node:dns';
import type { LookupFunction } from 'node:net';
import type { WebhookEndpoint } from '../src/types.js';
const lookup = jest.fn<(host: string, options: { all: true }) => Promise<LookupAddress[]>>();
const request = jest.fn<(url: URL, options: RequestOptions, callback: (response: IncomingMessage) => void) => ClientRequest>();
jest.unstable_mockModule('node:dns/promises', () => ({ lookup }));
jest.unstable_mockModule('node:https', () => ({ request }));
const { deliverOnce, signPayload, validateWebhookUrl } = await import('../src/webhook-transport.js');
const endpoint = { id: 'endpoint', url: 'https://receiver.example/hook?version=1', secret: 'fixture-secret' } as WebhookEndpoint;
const payload = { id: 'event', type: 'risk.created' as const, createdAt: '2026-11-16T10:00:00Z', organisationId: 'org', data: { text: '£25' } };
let responseStatus = 204;
let receivedBody = '';
let destroyed = false;
beforeEach(() => {
  jest.replaceProperty(process, 'env', { ...process.env, NODE_ENV: 'production' });
  lookup.mockReset(); request.mockReset();
  responseStatus = 204; receivedBody = ''; destroyed = false;
  lookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);
  request.mockImplementation((_url, _options, callback) => {
    const req = new EventEmitter();
    Object.assign(req, { end: (body: string) => {
      receivedBody = body;
      callback({ statusCode: responseStatus, destroy: () => { destroyed = true; } } as unknown as IncomingMessage);
    } });
    return req as ClientRequest;
  });
});
afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });
describe('production webhook address pinning', () => {
  it('pins the validated DNS set, retaining the hostname, TLS checks, signed body and path', async () => {
    const addresses = [{ address: '93.184.216.34', family: 4 }, { address: '2606:4700:4700::1111', family: 6 }];
    lookup.mockResolvedValueOnce(addresses).mockResolvedValue([{ address: '127.0.0.1', family: 4 }]);
    expect(await deliverOnce(endpoint, payload)).toBe(204);
    const [url, options] = request.mock.calls[0];
    expect(url.href).toBe(endpoint.url);
    expect(url.hostname).toBe('receiver.example');
    expect(options.rejectUnauthorized).toBe(true);
    expect(options.agent).toBe(false);
    expect(options).not.toHaveProperty('checkServerIdentity');
    const callback = jest.fn();
    const pinned = options.lookup as LookupFunction;
    pinned('receiver.example', { all: true }, callback);
    expect(callback).toHaveBeenCalledWith(null, addresses);
    pinned('receiver.example', {}, callback);
    expect(callback).toHaveBeenLastCalledWith(null, '93.184.216.34', 4);
    expect(lookup).toHaveBeenCalledTimes(1);
    const headers = options.headers as Record<string, string>;
    const timestamp = Number(headers['X-StopFRA-Signature'].split(',')[0].slice(2));
    expect(headers['X-StopFRA-Signature']).toBe(signPayload(endpoint.secret, receivedBody, timestamp));
    expect(headers['X-StopFRA-Delivery']).toBe(payload.id);
    expect(headers['Content-Length']).toBe(String(Buffer.byteLength(receivedBody)));
    expect(destroyed).toBe(true);
  });
  it.each(['127.0.0.1', '10.0.0.1', '169.254.169.254', '::1', 'fd00::1', 'fe90::1', '::ffff:7f00:1', '::ffff:a00:1', '224.0.0.1'])('blocks DNS answers containing %s, even mixed with public records', async address => {
    lookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }, { address, family: address.includes(':') ? 6 : 4 }]);
    expect(await deliverOnce(endpoint, payload)).toBe(0);
    expect(request).not.toHaveBeenCalled();
  });
  it.each(['https://[::ffff:7f00:1]/', 'https://[fe90::1]/', 'https://localhost./', 'https://127.1/', 'http://receiver.example/', 'https://u:password@receiver.example/'])('refuses invalid destinations without DNS or HTTP: %s', async url => {
    expect(validateWebhookUrl(url)).not.toBeNull();
    expect(await deliverOnce({ ...endpoint, url }, payload)).toBe(0);
    expect(lookup).not.toHaveBeenCalled(); expect(request).not.toHaveBeenCalled();
  });
  it('accepts public IPv6 literals without resolving DNS', async () => {
    expect(await deliverOnce({ ...endpoint, url: 'https://[2606:4700:4700::1111]/hook' }, payload)).toBe(204);
    expect(lookup).not.toHaveBeenCalled();
  });
  it('does not follow a redirect or reuse the prior DNS result on the next attempt', async () => {
    responseStatus = 302;
    expect(await deliverOnce(endpoint, payload)).toBe(302);
    lookup.mockResolvedValue([{ address: '127.0.0.1', family: 4 }]);
    expect(await deliverOnce(endpoint, payload)).toBe(0);
    expect(request).toHaveBeenCalledTimes(1);
    expect(lookup).toHaveBeenCalledTimes(2);
  });
  it('blocks empty and failed DNS answers', async () => {
    lookup.mockResolvedValueOnce([]).mockRejectedValueOnce(new Error('DNS unavailable'));
    expect(await deliverOnce(endpoint, payload)).toBe(0);
    expect(await deliverOnce(endpoint, payload)).toBe(0);
    expect(request).not.toHaveBeenCalled();
  });
  it('times out DNS without sending after a late public answer', async () => {
    jest.useFakeTimers();
    jest.spyOn(AbortSignal, 'timeout').mockImplementation(ms => {
      const controller = new AbortController();
      setTimeout(() => controller.abort(new Error('Timed out')), ms);
      return controller.signal;
    });
    let resolve!: (addresses: LookupAddress[]) => void;
    lookup.mockReturnValue(new Promise(r => { resolve = r; }));
    const attempt = deliverOnce(endpoint, payload);
    await jest.advanceTimersByTimeAsync(10_000);
    expect(await attempt).toBe(0);
    resolve([{ address: '93.184.216.34', family: 4 }]);
    await Promise.resolve();
    expect(request).not.toHaveBeenCalled();
  });
  it('uses the same deadline during the HTTPS request', async () => {
    jest.useFakeTimers();
    jest.spyOn(AbortSignal, 'timeout').mockImplementation(ms => {
      const controller = new AbortController();
      setTimeout(() => controller.abort(new Error('Timed out')), ms);
      return controller.signal;
    });
    request.mockImplementation((_url, options) => {
      const req = new EventEmitter();
      Object.assign(req, { end: () => {
        options.signal!.addEventListener('abort', () => req.emit('error', new Error('Aborted')), { once: true });
      } });
      return req as ClientRequest;
    });
    const attempt = deliverOnce(endpoint, payload);
    await jest.advanceTimersByTimeAsync(10_000);
    expect(await attempt).toBe(0);
    expect(request.mock.calls[0][1].signal!.aborted).toBe(true);
  });
  it('returns the existing network-failure status for TLS/socket errors', async () => {
    request.mockImplementation(() => {
      const req = new EventEmitter();
      Object.assign(req, { end: () => { req.emit('error', new Error('TLS verification failed')); } });
      return req as ClientRequest;
    });
    expect(await deliverOnce(endpoint, payload)).toBe(0);
  });
});
