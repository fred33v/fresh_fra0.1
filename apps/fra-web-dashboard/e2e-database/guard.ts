/** This suite writes fixture accounts: never allow a remote or implicit database. */
export function browserTestDatabase(env: NodeJS.ProcessEnv = process.env): string {
  if (env.BROWSER_DATABASE_TEST !== '1' || !env.DATABASE_URL) {
    throw new Error('Browser database tests require BROWSER_DATABASE_TEST=1 and an explicit disposable DATABASE_URL');
  }
  let url: URL;
  try { url = new URL(env.DATABASE_URL); }
  catch { throw new Error('Invalid disposable browser database URL'); }
  if (!['postgres:', 'postgresql:'].includes(url.protocol)
    || !['localhost', '127.0.0.1'].includes(url.hostname)
    || !['/fra', '/fra_browser_test'].includes(url.pathname)
    || url.search || url.hash) {
    throw new Error('Browser database tests require a local fra/fra_browser_test database without URL overrides');
  }
  return env.DATABASE_URL;
}
