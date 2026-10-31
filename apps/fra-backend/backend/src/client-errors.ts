// ============================================================
// Frontend error reports. The web dashboard posts uncaught browser
// errors to /api/v1/client-errors. Each report is scrubbed of anything
// that could identify a person or unlock an account, written to the
// backend log, and counted. The count goes to CloudWatch once a minute
// (metric StopFRA/ClientErrors), where an alarm emails the team.
// ============================================================

import { z } from 'zod';
import { CloudWatchClient, PutMetricDataCommand } from '@aws-sdk/client-cloudwatch';
import { createLogger } from './logger.js';

const logger = createLogger('client-error');

/** Cuts a string to a length instead of rejecting the report: a long stack is still worth logging. */
const clipped = (max: number) => z.string().transform((s) => s.slice(0, max));

export const clientErrorSchema = z.object({
  source: z.enum(['react', 'error', 'unhandledrejection']),
  message: clipped(1000),
  stack: clipped(8000).optional(),
  componentStack: clipped(4000).optional(),
  page: clipped(500),
  release: clipped(64).optional(),
});

export type ClientErrorReport = z.infer<typeof clientErrorSchema>;

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const JWT = /eyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}/g;
const BEARER = /Bearer\s+[A-Za-z0-9._~+/=-]+/gi;
// Long unbroken runs of letters and digits are keys, codes or tokens. Vite chunk hashes are 8 characters.
const LONG_TOKEN = /\b[A-Za-z0-9_-]{24,}\b/g;
// Query strings and fragments carry reset tokens, invitation codes and search terms
const URL_QUERY = /(https?:\/\/[^\s?#'")]+)[?#][^\s'")]*/g;

/** Removes email addresses, tokens and URL query strings from free text. */
export function scrubText(text: string): string {
  return text
    .replace(URL_QUERY, '$1')
    .replace(JWT, '[token]')
    .replace(BEARER, 'Bearer [token]')
    .replace(EMAIL, '[email]')
    .replace(LONG_TOKEN, '[token]');
}

/** Keeps only the path of the page, and hides the tokens some paths carry. */
export function scrubPage(page: string): string {
  let path = page;
  try {
    path = new URL(page, 'https://placeholder.invalid').pathname;
  } catch {
    path = page.split(/[?#]/)[0];
  }
  if (path.startsWith('/speak-up/') && path !== '/speak-up/status') path = '/speak-up/[token]';
  return scrubText(path);
}

export function scrubReport(report: ClientErrorReport): ClientErrorReport {
  return {
    source: report.source,
    message: scrubText(report.message),
    stack: report.stack ? scrubText(report.stack) : undefined,
    componentStack: report.componentStack ? scrubText(report.componentStack) : undefined,
    page: scrubPage(report.page),
    release: report.release ? scrubText(report.release) : undefined,
  };
}

// ── Counting and CloudWatch ─────────────────────────────────────

let pending = 0;

export function recordClientError(report: ClientErrorReport, browser?: string): void {
  const clean = scrubReport(report);
  pending += 1;
  // Warn, not error: the server is fine; the log line is for whoever investigates the alarm
  logger.warn('Frontend error', {
    ...clean,
    // Browser family and version only, never the full user agent
    browser: browser ? browserFamily(browser) : undefined,
  });
}

/** "Chrome 131", "Safari 18", "Firefox 133", "Edge 131" or "other". */
export function browserFamily(userAgent: string): string {
  const rules: Array<[string, RegExp]> = [
    ['Edge', /Edg\/(\d+)/],
    ['Firefox', /Firefox\/(\d+)/],
    ['Chrome', /Chrome\/(\d+)/],
    ['Safari', /Version\/(\d+)[\d.]* .*Safari/],
  ];
  for (const [name, re] of rules) {
    const m = userAgent.match(re);
    if (m) return `${name} ${m[1]}`;
  }
  return 'other';
}

/** Reports received since the last flush; resets the count. */
export function takePendingCount(): number {
  const n = pending;
  pending = 0;
  return n;
}

/**
 * Sends the count to CloudWatch every minute. Off unless running in production with an
 * AWS region set, so local runs and tests never call AWS. The instance role may put
 * metrics in the StopFRA namespace (infra/terraform/main.tf, backend_metrics).
 */
export function scheduleClientErrorMetrics(env: NodeJS.ProcessEnv = process.env): () => void {
  const region = env.AWS_REGION ?? env.S3_REGION;
  if (env.NODE_ENV !== 'production' || !region) return () => {};

  const client = new CloudWatchClient({ region });
  const timer = setInterval(async () => {
    const count = takePendingCount();
    if (count === 0) return;
    try {
      await client.send(new PutMetricDataCommand({
        Namespace: 'StopFRA',
        MetricData: [{ MetricName: 'ClientErrors', Value: count, Unit: 'Count' }],
      }));
    } catch (err) {
      // Keep the count so the next minute retries it
      pending += count;
      logger.warn('Could not send the frontend error count to CloudWatch', { error: (err as Error).message });
    }
  }, 60_000);
  timer.unref();
  return () => clearInterval(timer);
}
