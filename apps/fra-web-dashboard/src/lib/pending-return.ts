import { safeReturnPath } from './return-path';

const KEY = 'fra.pendingReturn';
// Long enough to find the confirmation email and click it, short enough not to redirect someone days later
const TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Remembers where a new account holder was headed, across the hop through their inbox: the confirmation link
 * opens a fresh page that no longer carries `returnTo`. Browser storage is only a convenience here (it can
 * be unavailable or empty), and whatever comes back is checked again as a same-site path before it is used.
 */
export function rememberReturn(path: string | null): void {
  try {
    const safe = safeReturnPath(path);
    if (safe) localStorage.setItem(KEY, JSON.stringify({ path: safe, at: Date.now() }));
  } catch {
    /* storage unavailable: the person simply lands on the dashboard */
  }
}

export function pendingReturn(now = Date.now()): string | null {
  try {
    const stored = JSON.parse(localStorage.getItem(KEY) ?? 'null') as { path?: unknown; at?: unknown } | null;
    if (!stored || typeof stored.path !== 'string' || typeof stored.at !== 'number') return null;
    if (now - stored.at > TTL_MS || stored.at > now) return null;
    return safeReturnPath(stored.path);
  } catch {
    return null;
  }
}

export function clearPendingReturn(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* nothing to clear */
  }
}
