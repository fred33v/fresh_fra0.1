import { test, expect } from '@playwright/test';

test('native EventSource renews its single-use token after a closed stream', async ({ page }) => {
  let tokens = 0;
  const connections: string[] = [];
  await page.route('**/sse-contract', route => route.fulfill({
    contentType: 'text/html', body: '<html><body>SSE reconnect contract</body></html>',
  }));
  await page.route('**/api/v1/workshop/**', async route => {
    const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*' };
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/sse-token')) {
      tokens++;
      return route.fulfill({ headers, contentType: 'application/json', body: JSON.stringify({ success: true, data: { sseToken: `token-${tokens}` } }) });
    }
    const credential = url.searchParams.get('sse_token') ?? '';
    const duplicate = connections.includes(credential);
    connections.push(credential);
    return route.fulfill({
      status: duplicate ? 401 : 200, headers, contentType: 'text/event-stream',
      // Ending a stream triggers reconnection in the real browser EventSource.
      body: duplicate ? '' : `event: update\ndata: ${JSON.stringify({ credential })}\n\n`,
    });
  });
  await page.goto('/sse-contract');
  await page.evaluate(async () => {
    const path = '/src/lib/api.ts';
    const { setTokens, connectSSE } = await import(path);
    setTokens('fixture-access', 'fixture-refresh');
    const events: unknown[] = [];
    const stop = connectSSE('/api/v1/workshop/sessions/fixture/events', { update: (event: unknown) => events.push(event) });
    Object.assign(window, { sseContract: { events, stop } });
  });
  await expect.poll(() => connections.length).toBeGreaterThanOrEqual(2);
  expect(connections.slice(0, 2)).toEqual(['token-1', 'token-2']);
  await expect.poll(() => page.evaluate(() => {
    const state = (window as unknown as { sseContract: { events: unknown[] } }).sseContract;
    return state.events.length;
  })).toBeGreaterThanOrEqual(2);
  await page.evaluate(() => (window as unknown as { sseContract: { stop: () => void } }).sseContract.stop());
  const stoppedTokens = tokens;
  await page.waitForTimeout(2200);
  expect(tokens).toBe(stoppedTokens);
  expect(new Set(connections).size).toBe(connections.length);
});
