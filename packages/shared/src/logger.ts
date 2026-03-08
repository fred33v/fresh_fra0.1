const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 } as const;
type LogLevel = keyof typeof LOG_LEVELS;

// __DEV__ is defined by the React Native runtime
const MIN_LEVEL: LogLevel = typeof __DEV__ !== 'undefined' && __DEV__ ? 'debug' : 'warn';

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[MIN_LEVEL];
}

function log(level: LogLevel, context: string, message: string, data?: unknown): void {
  if (!shouldLog(level)) return;
  const formatted = `[${level.toUpperCase()}][${context}] ${message}`;
  switch (level) {
    case 'error':
      console.error(formatted, data ?? '');
      break;
    case 'warn':
      console.warn(formatted, data ?? '');
      break;
    default:
      console.log(formatted, data ?? '');
  }
}

export function createLogger(context: string) {
  return {
    debug: (message: string, data?: unknown) => log('debug', context, message, data),
    info: (message: string, data?: unknown) => log('info', context, message, data),
    warn: (message: string, data?: unknown) => log('warn', context, message, data),
    error: (message: string, data?: unknown) => log('error', context, message, data),
  };
}

export type Logger = ReturnType<typeof createLogger>;
