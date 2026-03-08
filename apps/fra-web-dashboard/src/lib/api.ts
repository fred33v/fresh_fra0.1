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

type ApiResponse<T> = {
  success: true;
  data: T;
} | {
  success: false;
  error: { code: string; message: string };
};

export class ApiError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
  }
}

let refreshPromise: Promise<boolean> | null = null;

function getAccessToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_KEY);
}

export function setTokens(access: string, refresh: string) {
  localStorage.setItem(TOKEN_KEY, access);
  localStorage.setItem(REFRESH_KEY, refresh);
}

export function clearTokens() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

export function hasStoredTokens(): boolean {
  return !!getAccessToken();
}

async function refreshAccessToken(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;

  try {
    const res = await fetch(`${API_URL}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!res.ok) {
      clearTokens();
      return false;
    }

    const json = await res.json() as ApiResponse<{ accessToken: string; refreshToken: string }>;
    if (!json.success) {
      clearTokens();
      return false;
    }

    setTokens(json.data.accessToken, json.data.refreshToken);
    return true;
  } catch (err: unknown) {
    logger.warn('Token refresh failed', err);
    clearTokens();
    return false;
  }
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
    const err = json as { success: false; error: { code: string; message: string } };
    throw new ApiError(err.error.code, err.error.message);
  }

  return json.data;
}

export const api = {
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
