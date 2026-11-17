/** Plain HTTP is restricted to loopback development/test, never production. */
export function esignOrigin(value: string, environment = process.env.NODE_ENV): string {
  const url = new URL(value);
  const localHttp =
    url.protocol === 'http:' &&
    ['development', 'test'].includes(environment ?? '') &&
    ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== '/' ||
    (url.protocol !== 'https:' && !localHttp)
  )
    throw new Error('Invalid ESIGN_PUBLIC_URL');
  return url.origin;
}
