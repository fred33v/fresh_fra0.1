import { describe, expect, it } from '@jest/globals';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadBackendEnvironment } from '../src/env.js';

describe('Neon environment loading in the monorepo', () => {
  it('loads the root Neon env from the backend package and preserves injected secrets', () => {
    const root = mkdtempSync(join(tmpdir(), 'fra-env-'));
    try {
      const cwd = join(root, 'backend'); mkdirSync(cwd);
      writeFileSync(join(root, '.env.local'), 'DATABASE_URL=pooled-fixture\nDATABASE_URL_UNPOOLED=direct-fixture\n');
      const env: NodeJS.ProcessEnv = { DATABASE_URL: 'injected-fixture' };
      loadBackendEnvironment(cwd, root, env);
      expect(env.DATABASE_URL).toBe('injected-fixture');
      expect(env.DATABASE_URL_UNPOOLED).toBeUndefined();
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
  it('preserves package overrides and supports a root .env file', () => {
    const root = mkdtempSync(join(tmpdir(), 'fra-env-'));
    try {
      const cwd = join(root, 'backend'); mkdirSync(cwd);
      writeFileSync(join(root, '.env'), 'DATABASE_URL=root-fixture\nDATABASE_URL_UNPOOLED=direct-fixture\n');
      writeFileSync(join(cwd, '.env.local'), 'DATABASE_URL=package-fixture\n');
      const env: NodeJS.ProcessEnv = {};
      loadBackendEnvironment(cwd, root, env);
      expect(env.DATABASE_URL).toBe('package-fixture');
      expect(env.DATABASE_URL_UNPOOLED).toBeUndefined();
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
  it('loads both connection URLs from the root Neon file when neither is injected', () => {
    const root = mkdtempSync(join(tmpdir(), 'fra-env-'));
    try {
      const cwd = join(root, 'backend'); mkdirSync(cwd);
      writeFileSync(join(root, '.env.local'), 'DATABASE_URL=pooled-fixture\nDATABASE_URL_UNPOOLED=direct-fixture\n');
      const env: NodeJS.ProcessEnv = {};
      loadBackendEnvironment(cwd, root, env);
      expect(env.DATABASE_URL).toBe('pooled-fixture');
      expect(env.DATABASE_URL_UNPOOLED).toBe('direct-fixture');
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

});
