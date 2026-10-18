/**
 * Small per-device preferences (guide progress, contacts typed in by the user).
 * Browser storage can be missing or blocked (private windows, strict settings),
 * so every read and write falls back quietly instead of breaking the page.
 */
export function readLocal<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function writeLocal(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Not stored on this device; the page keeps working without it
  }
}
