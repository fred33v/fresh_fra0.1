import type { Href } from 'expo-router';

/**
 * Validates a post-sign-in destination from a route parameter. Only in-app paths such as
 * "/payment" are allowed; anything else (other schemes, "//host", missing) falls back to home.
 */
export function safeReturnTo(value: string | string[] | undefined): Href {
  const path = Array.isArray(value) ? value[0] : value;
  if (!path || !path.startsWith('/') || path.startsWith('//') || path.includes('://')) return '/';
  return path as Href;
}
