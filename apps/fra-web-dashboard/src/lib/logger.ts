const isProd = import.meta.env.PROD;

const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 } as const;
type LogLevel = keyof typeof LOG_LEVELS;
const MIN_LEVEL: LogLevel = isProd ? 'warn' : 'debug';

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[MIN_LEVEL];
}

function log(level: LogLevel, context: string, message: string, data?: unknown): void {
  if (!shouldLog(level)) return;
  const formatted = `[${level.toUpperCase()}][${context}] ${message}`;
  if (level === 'error') console.error(formatted, data ?? '');
  else if (level === 'warn') console.warn(formatted, data ?? '');
  else console.log(formatted, data ?? '');
}

export function createLogger(context: string) {
  return {
    debug: (msg: string, data?: unknown) => log('debug', context, msg, data),
    info: (msg: string, data?: unknown) => log('info', context, msg, data),
    warn: (msg: string, data?: unknown) => log('warn', context, msg, data),
    error: (msg: string, data?: unknown) => log('error', context, msg, data),
  };
}

export type Logger = ReturnType<typeof createLogger>;

// Backward-compatible default export
export const logger = createLogger('FRA');
