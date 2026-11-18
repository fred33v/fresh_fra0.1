import { describe, expect, it } from '@jest/globals';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const script = fileURLToPath(new URL('../scripts/esign-live-demo.mjs', import.meta.url));
function refused(overrides: NodeJS.ProcessEnv, expected: string) {
  const result = spawnSync(process.execPath, ['--import', 'tsx', script, 'owner@example.test'], {
    env: {
      ...process.env,
      NODE_ENV: 'development',
      ESIGN_ENABLED: 'true',
      ESIGN_LIVE_TEST: '1',
      ESIGN_PUBLIC_URL: 'http://localhost:3080',
      DATABASE_URL: 'postgresql://fixture@127.0.0.1:5432/fresh_fra_esign_dev',
      DATABASE_URL_UNPOOLED: 'postgresql://fixture@127.0.0.1:5432/fresh_fra_esign_dev',
      ...overrides,
    },
    encoding: 'utf8',
    timeout: 15000,
  });
  expect(result.status).toBe(1);
  expect(result.stderr).toContain(expected);
}
describe('live signing demo refuses unsafe targets before AWS or API calls', () => {
  it('requires explicit opt-in', () => refused({ ESIGN_LIVE_TEST: '0' }, 'Use ESIGN_LIVE_TEST=1'));
  it('refuses a remote API even over HTTPS', () =>
    refused({ ESIGN_PUBLIC_URL: 'https://example.test' }, 'Only a loopback API is permitted'));
  it('refuses a non-development database or connection-host override', () => {
    refused({ DATABASE_URL: 'postgresql://fixture@127.0.0.1:5432/production' }, 'dedicated local');
    refused(
      {
        DATABASE_URL:
          'postgresql://fixture@127.0.0.1:5432/fresh_fra_esign_dev?host=remote.example.test',
      },
      'dedicated local'
    );
  });
});
