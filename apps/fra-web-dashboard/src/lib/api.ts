// ============================================================
// Stop FRA - API Client (replaces Supabase client)
// ============================================================

import { createLogger } from './logger';
import { API_DEFAULTS } from '@stopfra/shared/constants';
const logger = createLogger('ApiClient');

const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? API_DEFAULTS.PRODUCTION_URL : API_DEFAULTS.DEV_URL);
if (import.meta.env.PROD && API_URL && !API_URL.startsWith('https://')) {
  logger.warn('API URL is not HTTPS in production — tokens may be sent over an insecure connection');
}
const TOKEN_KEY = 'fra_access_token';
const REFRESH_KEY = 'fra_refresh_token';
const SESSION_KEY = 'fra_session_id';

type ApiResponse<T> = {
  success: true;
  data: T;
} | {
  success: false;
  error: { code: string; message: string };
};

export class ApiError extends Error {
  code: string;
  /** Extra detail some refusals carry, e.g. the quiz score when the pass mark is not reached */
  details?: unknown;
  constructor(code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.details = details;
  }
}

let refreshPromise: Promise<boolean> | null = null;

function getAccessToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_KEY);
}

function writeTokens(access: string, refresh: string) {
  localStorage.setItem(TOKEN_KEY, access);
  localStorage.setItem(REFRESH_KEY, refresh);
}

/** A new login starts a new session; rotation preserves this marker across tabs. */
export function setTokens(access: string, refresh: string) {
  localStorage.setItem(SESSION_KEY, Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join(''));
  writeTokens(access, refresh);
}

export function clearTokens() {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

export function hasStoredTokens(): boolean {
  return !!getAccessToken();
}

async function refreshAccessToken(): Promise<boolean> {
  const attemptedToken = getRefreshToken();
  const session = localStorage.getItem(SESSION_KEY);
  if (!attemptedToken) return false;
  const sameSession = () => localStorage.getItem(SESSION_KEY) === session;
  const replacementAvailable = () => sameSession() && !!getRefreshToken() && hasStoredTokens();
  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
  const rotate = async (): Promise<boolean> => {
    // A queued tab can use the preceding tab's rotation, but never a different login.
    if (!sameSession()) return false;
    if (getRefreshToken() !== attemptedToken) return replacementAvailable();
    try {
      const res = await fetch(`${API_URL}/api/v1/auth/refresh`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: attemptedToken }),
      });
      // Logout, another login or a peer's rotation wins over this stale response.
      if (!sameSession()) return false;
      if (getRefreshToken() !== attemptedToken) return replacementAvailable();
      if (!res.ok) {
        // Without Web Locks, a peer may still be rotating this token. Keep credentials
        // so its successful response can commit; the server continues to refuse replay.
        if (locks && (res.status === 401 || res.status === 403)) clearTokens();
        return false;
      }
      const json = await res.json() as ApiResponse<{ accessToken: string; refreshToken: string }>;
      if (!sameSession()) return false;
      if (getRefreshToken() !== attemptedToken) return replacementAvailable();
      if (!json.success) return false;
      writeTokens(json.data.accessToken, json.data.refreshToken);
      return true;
    } catch (err: unknown) {
      logger.warn('Token refresh failed', err);
      // A transient transport/server failure must not sign out this or another tab.
      return false;
    }
  };
  return locks ? locks.request('fra-auth-refresh', rotate) : rotate();
}

async function request<T>(method: string, path: string, body?: unknown, retry = true): Promise<T> {
  const token = getAccessToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  // Handle 401 with token refresh
  if (res.status === 401 && retry && getRefreshToken()) {
    // Deduplicate concurrent refresh attempts
    if (!refreshPromise) {
      refreshPromise = refreshAccessToken().finally(() => { refreshPromise = null; });
    }
    const refreshed = await refreshPromise;
    if (refreshed) {
      return request<T>(method, path, body, false);
    }
    throw new Error('Session expired. Please sign in again.');
  }

  let json: ApiResponse<T>;
  try {
    json = await res.json() as ApiResponse<T>;
  } catch {
    throw new ApiError('NETWORK_ERROR', `Server returned ${res.status} with non-JSON response`);
  }

  if (!json.success) {
    const err = json as { success: false; error: { code: string; message: string }; data?: unknown };
    throw new ApiError(err.error.code, err.error.message, err.data);
  }

  return json.data;
}

/** Fetch a file (e.g. ?format=csv) with the user's token and save it in the browser. */
async function download(path: string, filename: string, retry = true): Promise<void> {
  const token = getAccessToken();
  const res = await fetch(`${API_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (res.status === 401 && retry && getRefreshToken()) {
    if (!refreshPromise) {
      refreshPromise = refreshAccessToken().finally(() => { refreshPromise = null; });
    }
    if (await refreshPromise) return download(path, filename, false);
    throw new Error('Session expired. Please sign in again.');
  }

  if (!res.ok) {
    const json = await res.json().catch(() => null) as { error?: { code: string; message: string } } | null;
    throw new ApiError(json?.error?.code ?? 'DOWNLOAD_FAILED', json?.error?.message ?? `Download failed (${res.status})`);
  }

  const url = URL.createObjectURL(await res.blob());
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * For public pages that must not identify the caller (the speak-up report form):
 * never sends the signed-in user's token, cookies or the page address.
 */
async function anonymousRequest<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined,
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
  });
  let json: ApiResponse<T>;
  try {
    json = await res.json() as ApiResponse<T>;
  } catch {
    throw new ApiError('NETWORK_ERROR', `Server returned ${res.status} with non-JSON response`);
  }
  if (!json.success) {
    const err = json as { success: false; error: { code: string; message: string } };
    throw new ApiError(err.error.code, err.error.message);
  }
  return json.data;
}

export const anonymousApi = {
  get: <T>(path: string) => anonymousRequest<T>('GET', path),
  post: <T>(path: string, body: unknown) => anonymousRequest<T>('POST', path, body),
};

export const api = {
  download,
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
};

// ── SSE Helper ──────────────────────────────────────────────

type SSEHandlers = Record<string, (data: unknown) => void>;

/**
 * Connects to an SSE endpoint using a short-lived, single-use SSE token
 * instead of passing the long-lived JWT directly as a query parameter.
 * This limits exposure in browser history, server logs, and referer headers.
 */
export function connectSSE(path: string, handlers: SSEHandlers): () => void {
  let es: EventSource | null = null;
  let closed = false;

  // Obtain a short-lived SSE token from the backend, then open EventSource
  (async () => {
    try {
      const { sseToken } = await api.post<{ sseToken: string }>('/api/v1/workshop/sse-token');
      if (closed) return; // caller already called cleanup

      const url = `${API_URL}${path}${path.includes('?') ? '&' : '?'}sse_token=${encodeURIComponent(sseToken)}`;
      es = new EventSource(url);

      // If cleanup was called while we were creating the EventSource, close immediately
      if (closed) {
        es.close();
        es = null;
        return;
      }

      for (const [event, handler] of Object.entries(handlers)) {
        es.addEventListener(event, (e: MessageEvent) => {
          if (closed) return;
          try {
            handler(JSON.parse(e.data));
          } catch (parseErr) {
            logger.warn('SSE JSON parse error', parseErr);
          }
        });
      }

      es.onerror = () => {
        if (closed) return;
        // EventSource auto-reconnects; we just log
        logger.warn('SSE connection error, reconnecting...');
      };
    } catch (err: unknown) {
      if (!closed) {
        logger.warn('Failed to obtain SSE token', err);
      }
    }
  })();

  // Return cleanup function
  return () => {
    closed = true;
    es?.close();
  };
}
