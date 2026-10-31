// ============================================================
// Frontend error reporting. Uncaught errors (React render errors,
// window errors and unhandled promise rejections) are posted to our
// own API at /api/v1/client-errors, which logs them and raises a
// CloudWatch alarm. No third-party service is involved.
//
// Privacy: only the error, its stack, the page path (no query string)
// and the build version are sent. No user id, email, form contents or
// cookies. The backend scrubs the report again before logging it.
// ============================================================

import { API_DEFAULTS } from '@stopfra/shared/constants';

// Same API address as lib/api.ts. Not imported from there, so that tests mocking the API
// client still get a working reporter.
const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? API_DEFAULTS.PRODUCTION_URL : API_DEFAULTS.DEV_URL);

export type ErrorSource = 'react' | 'error' | 'unhandledrejection';

interface ReporterOptions {
  endpoint: string;
  enabled: boolean;
  release?: string;
  /** Reports sent per page load at most, so a render loop cannot flood the API */
  maxPerPage?: number;
  send?: (endpoint: string, body: string) => void;
}

// Noise that is not our bug: browser quirks and errors thrown by extensions
const IGNORED_MESSAGES = [/ResizeObserver loop/i, /^Script error\.?$/i];
const EXTENSION_FRAME = /(chrome|moz|safari(-web)?)-extension:\/\//;

function defaultSend(endpoint: string, body: string): void {
  // keepalive lets the request finish if the error happens while the page unloads
  fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
    credentials: 'omit',
  }).catch(() => { /* reporting must never cause another error */ });
}

function describe(error: unknown): { message: string; stack?: string } {
  if (error instanceof Error) return { message: `${error.name}: ${error.message}`, stack: error.stack };
  if (typeof error === 'string') return { message: error };
  try {
    return { message: JSON.stringify(error) ?? String(error) };
  } catch {
    return { message: String(error) };
  }
}

export function createErrorReporter(opts: ReporterOptions) {
  const send = opts.send ?? defaultSend;
  const max = opts.maxPerPage ?? 10;
  const seen = new Set<string>();
  let sent = 0;

  function report(source: ErrorSource, error: unknown, componentStack?: string): void {
    if (!opts.enabled || sent >= max) return;
    const { message, stack } = describe(error);
    if (IGNORED_MESSAGES.some((re) => re.test(message))) return;
    if (stack && EXTENSION_FRAME.test(stack)) return;

    // The same error once per page load
    const key = `${source}|${message}`;
    if (seen.has(key)) return;
    seen.add(key);
    sent += 1;

    send(opts.endpoint, JSON.stringify({
      source,
      message: message.slice(0, 1000),
      stack: stack?.slice(0, 8000),
      componentStack: componentStack?.slice(0, 4000),
      page: window.location.pathname,
      release: opts.release,
    }));
  }

  /** Listens for errors React does not catch. Returns a function that stops listening. */
  function install(): () => void {
    const onError = (event: ErrorEvent) => report('error', event.error ?? event.message);
    const onRejection = (event: PromiseRejectionEvent) => report('unhandledrejection', event.reason);
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }

  return { report, install };
}

// On in production builds; VITE_ERROR_REPORTING=true turns it on elsewhere for testing
const reporter = createErrorReporter({
  endpoint: `${API_URL}/api/v1/client-errors`,
  enabled: import.meta.env.PROD || import.meta.env.VITE_ERROR_REPORTING === 'true',
  release: import.meta.env.VITE_APP_VERSION || undefined,
});

export const reportError = reporter.report;
export const installErrorReporting = reporter.install;
