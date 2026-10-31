import { describe, it, expect, vi, afterEach } from 'vitest';
import { createErrorReporter } from '@/lib/errorReporter';

function setup(overrides: Partial<Parameters<typeof createErrorReporter>[0]> = {}) {
  const send = vi.fn<(endpoint: string, body: string) => void>();
  const reporter = createErrorReporter({ endpoint: 'https://api.test/api/v1/client-errors', enabled: true, release: 'abc1234', send, ...overrides });
  const bodies = () => send.mock.calls.map(([, body]) => JSON.parse(body));
  return { reporter, send, bodies };
}

describe('errorReporter', () => {
  afterEach(() => window.history.replaceState(null, '', '/'));

  it('sends the error, stack, page path and release, without the query string', () => {
    window.history.replaceState(null, '', '/employer?invite=secret#tab');
    const { reporter, send, bodies } = setup();
    reporter.report('react', new TypeError('x is undefined'), '\n    at Widget');
    expect(send).toHaveBeenCalledWith('https://api.test/api/v1/client-errors', expect.any(String));
    const [body] = bodies();
    expect(body).toMatchObject({ source: 'react', message: 'TypeError: x is undefined', page: '/employer', release: 'abc1234', componentStack: '\n    at Widget' });
    expect(body.stack).toContain('x is undefined');
    expect(JSON.stringify(body)).not.toContain('secret');
  });

  it('does nothing when disabled', () => {
    const { reporter, send } = setup({ enabled: false });
    reporter.report('error', new Error('boom'));
    expect(send).not.toHaveBeenCalled();
  });

  it('sends the same error once and caps reports per page', () => {
    const { reporter, send } = setup({ maxPerPage: 3 });
    reporter.report('error', new Error('same'));
    reporter.report('error', new Error('same'));
    expect(send).toHaveBeenCalledTimes(1);
    for (let i = 0; i < 10; i++) reporter.report('error', new Error(`e${i}`));
    expect(send).toHaveBeenCalledTimes(3);
  });

  it('ignores browser noise and extension errors', () => {
    const { reporter, send } = setup();
    reporter.report('error', 'ResizeObserver loop completed with undelivered notifications.');
    reporter.report('error', 'Script error.');
    const ext = new Error('from extension');
    ext.stack = 'Error: from extension\n    at chrome-extension://abc/content.js:1:1';
    reporter.report('error', ext);
    expect(send).not.toHaveBeenCalled();
  });

  it('reports non-Error rejection reasons', () => {
    const { reporter, bodies } = setup();
    reporter.report('unhandledrejection', { code: 'NETWORK' });
    expect(bodies()[0]).toMatchObject({ source: 'unhandledrejection', message: '{"code":"NETWORK"}' });
  });

  it('install listens for window errors and unhandled rejections until removed', () => {
    // Call the handlers directly: dispatching a real error event would also reach the test runner
    const add = vi.spyOn(window, 'addEventListener');
    const remove = vi.spyOn(window, 'removeEventListener');
    const { reporter, bodies } = setup();
    const uninstall = reporter.install();
    const handler = (type: string) => add.mock.calls.find(([t]) => t === type)![1] as (e: unknown) => void;
    handler('error')({ error: new Error('window boom'), message: 'window boom' });
    handler('error')({ error: null, message: 'plain message' });
    handler('unhandledrejection')({ reason: new Error('rejected') });
    uninstall();
    expect(remove.mock.calls.map(([t]) => t)).toEqual(['error', 'unhandledrejection']);
    expect(bodies().map((b) => [b.source, b.message])).toEqual([
      ['error', 'Error: window boom'],
      ['error', 'plain message'],
      ['unhandledrejection', 'Error: rejected'],
    ]);
    add.mockRestore();
    remove.mockRestore();
  });
});
