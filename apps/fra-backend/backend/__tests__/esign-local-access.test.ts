import { describe, expect, it, afterEach } from '@jest/globals';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const script = fileURLToPath(new URL('../scripts/esign-local-access.mjs', import.meta.url));
const loader = createRequire(import.meta.url).resolve('tsx');
const directories: string[] = [];
afterEach(() => {
  for (const dir of directories.splice(0)) rmSync(dir, { recursive: true, force: true });
});
function run(overrides: NodeJS.ProcessEnv = {}, valid = true) {
  const cwd = mkdtempSync(join(tmpdir(), 'fra-local-access-'));
  directories.push(cwd);
  const email = 'owner@example.test',
    password = 'Synthetic-Private-Clipboard-Only-42';
  const digest = createHash('sha256')
    .update('http://localhost:3080' + email)
    .digest('hex')
    .slice(0, 20);
  mkdirSync(join(cwd, '.local', 'esign'), { recursive: true });
  writeFileSync(
    join(cwd, '.local', 'esign', `demo-account-${digest}.json`),
    JSON.stringify({ email: valid ? email : 'someone-else@example.test', password }),
    { mode: 0o600 }
  );
  const result = spawnSync(process.execPath, ['--import', loader, script, email, '--check'], {
    cwd,
    env: {
      ...process.env,
      NODE_ENV: 'development',
      DATABASE_URL: 'postgresql://fixture@127.0.0.1:5432/fresh_fra_esign_dev',
      DATABASE_URL_UNPOOLED: 'postgresql://fixture@127.0.0.1:5432/fresh_fra_esign_dev',
      ESIGN_PUBLIC_URL: 'http://localhost:3080',
      ...overrides,
    },
    encoding: 'utf8',
    timeout: 15000,
  });
  expect(result.stdout + result.stderr).not.toContain(password);
  return result;
}
describe('private local demo access', () => {
  it('finds the existing demo account without printing or copying its password in check mode', () => {
    const result = run();
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('No password printed or copied');
  });
  it('refuses production and remote or overridden database targets', () => {
    expect(run({ NODE_ENV: 'production' }).status).toBe(1);
    expect(
      run({ DATABASE_URL: 'postgresql://fixture@remote.example.test/fresh_fra_esign_dev' }).status
    ).toBe(1);
    expect(
      run({
        DATABASE_URL_UNPOOLED:
          'postgresql://fixture@localhost/fresh_fra_esign_dev?host=remote.example.test',
      }).status
    ).toBe(1);
  });
  it('refuses a remote signing origin and a mismatched local account', () => {
    expect(run({ ESIGN_PUBLIC_URL: 'https://example.test' }).status).toBe(1);
    expect(run({}, false).status).toBe(1);
  });
});
