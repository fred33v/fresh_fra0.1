/** A same-site path to return to after sign-in; anything else (other sites, "//host", the sign-in page itself) is ignored. */
export function safeReturnPath(value: string | null): string | null {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return null;
  if (value === '/auth' || value.startsWith('/auth?') || value.startsWith('/auth/')) return null;
  return value;
}
