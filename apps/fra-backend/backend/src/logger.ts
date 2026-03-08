type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface Logger {
  debug: (message: string, data?: Record<string, unknown>) => void;
  info: (message: string, data?: Record<string, unknown>) => void;
  warn: (message: string, data?: Record<string, unknown>) => void;
  error: (message: string, data?: Record<string, unknown>) => void;
}

const isProduction = process.env.NODE_ENV === 'production';

function log(level: LogLevel, context: string, message: string, data?: Record<string, unknown>): void {
  const entry = {
    ts: new Date().toISOString(),
    level,
    context,
    message,
    ...(data ? { data } : {}),
  };

  if (level === 'error') {
    console.error(JSON.stringify(entry));
  } else if (level === 'warn') {
    console.warn(JSON.stringify(entry));
  } else {
    console.log(JSON.stringify(entry));
  }
}

export function createLogger(context: string): Logger {
  return {
    debug: (message, data) => { if (!isProduction) log('debug', context, message, data); },
    info: (message, data) => { if (!isProduction) log('info', context, message, data); },
    warn: (message, data) => log('warn', context, message, data),
    error: (message, data) => log('error', context, message, data),
  };
}
