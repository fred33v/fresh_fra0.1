import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError, clearTokens, connectSSE, setTokens } from '@/lib/api';
class Source {
  static instances: Source[] = [];
  onerror: (() => void) | null = null;
  onopen: (() => void) | null = null;
  close = vi.fn();
  addEventListener = vi.fn();
  constructor(public url: string) { Source.instances.push(this); }
}
const token = (sseToken: string) => ({ sseToken });
const flush = async () => { await Promise.resolve(); await Promise.resolve(); };
beforeEach(() => {
  vi.useFakeTimers();
  Source.instances = [];
  vi.stubGlobal('EventSource', Source);
  const storage = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  });
  setTokens('access', 'refresh');
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });
describe('SSE reconnection', () => {
  it('closes the spent source and exchanges a fresh token after each disconnect', async () => {
    const post = vi.spyOn(api, 'post').mockResolvedValueOnce(token('first')).mockResolvedValueOnce(token('second'));
    const stop = connectSSE('/events?session=1', {});
    await flush();
    const first = Source.instances[0];
    expect(first.url).toContain('&sse_token=first');
    first.onerror!(); first.onerror!();
    expect(first.close).toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1000);
    expect(post).toHaveBeenCalledTimes(2);
    expect(Source.instances[1].url).toContain('sse_token=second');
    stop();
  });
  it('retries a token exchange failure with bounded backoff', async () => {
    const post = vi.spyOn(api, 'post').mockRejectedValue(new Error('offline'));
    const stop = connectSSE('/events', {});
    await flush();
    await vi.advanceTimersByTimeAsync(1000);
    expect(post).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1999);
    expect(post).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(post).toHaveBeenCalledTimes(3);
    stop();
  });
  it('cancels scheduled reconnects on cleanup', async () => {
    const post = vi.spyOn(api, 'post').mockResolvedValue(token('first'));
    const stop = connectSSE('/events', {});
    await flush(); Source.instances[0].onerror!(); stop();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(post).toHaveBeenCalledTimes(1);
  });
  it('does not open a stream when cleanup occurs during token exchange', async () => {
    let resolve!: (value: { sseToken: string }) => void;
    vi.spyOn(api, 'post').mockReturnValue(new Promise(r => { resolve = r; }));
    const stop = connectSSE('/events', {});
    stop(); resolve(token('late')); await flush();
    expect(Source.instances).toHaveLength(0);
  });
  it('does not reconnect as a newly signed-in account', async () => {
    const post = vi.spyOn(api, 'post').mockResolvedValue(token('first'));
    const stop = connectSSE('/events', {});
    await flush(); Source.instances[0].onerror!();
    clearTokens(); setTokens('other', 'other-refresh');
    await vi.advanceTimersByTimeAsync(1000);
    expect(post).toHaveBeenCalledTimes(1);
    stop();
  });
  it('stops retrying when token exchange refuses authority', async () => {
    const post = vi.spyOn(api, 'post').mockRejectedValue(new ApiError('FORBIDDEN', 'Not allowed'));
    const stop = connectSSE('/events', {});
    await flush(); await vi.advanceTimersByTimeAsync(60_000);
    expect(post).toHaveBeenCalledTimes(1);
    stop();
  });
  it('never backs off longer than thirty seconds', async () => {
    const post = vi.spyOn(api, 'post').mockRejectedValue(new Error('offline'));
    const stop = connectSSE('/events', {});
    await flush();
    for (const delay of [1000, 2000, 4000, 8000, 16000, 30000, 30000]) {
      const attempts = post.mock.calls.length;
      await vi.advanceTimersByTimeAsync(delay - 1);
      expect(post).toHaveBeenCalledTimes(attempts);
      await vi.advanceTimersByTimeAsync(1);
      expect(post).toHaveBeenCalledTimes(attempts + 1);
    }
    stop();
  });

});
