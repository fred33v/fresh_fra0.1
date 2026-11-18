import { config } from 'dotenv';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = fileURLToPath(new URL('../../../../', import.meta.url));

/** Local package overrides first; injected deployment secrets always win. */
export function loadBackendEnvironment(
  cwd = process.cwd(),
  root = repositoryRoot,
  env: NodeJS.ProcessEnv = process.env,
): void {
  const paths = [...new Set([
    resolve(cwd, '.env.local'), resolve(cwd, '.env'),
    resolve(root, '.env.local'), resolve(root, '.env'),
  ])];
  for (const path of paths) {
    const databaseAlreadySet = !!env.DATABASE_URL;
    const directAlreadySet = !!env.DATABASE_URL_UNPOOLED;
    config({ path, processEnv: env as Record<string, string>, override: false });
    // Never pair an injected/test/package database with a different root database.
    // The direct URL must come from the same file or an explicit earlier setting.
    if (databaseAlreadySet && !directAlreadySet) delete env.DATABASE_URL_UNPOOLED;
  }
}

if (process.env.NODE_ENV !== 'test') loadBackendEnvironment();
