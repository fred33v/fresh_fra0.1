import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('logger', () => {
  beforeEach(() => {
    vi.spyOn(console, 'debug').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('createLogger produces contextual log messages', async () => {
    const { createLogger } = await import('@/lib/logger');
    const log = createLogger('TestCtx');
    log.warn('test message');
    expect(console.warn).toHaveBeenCalledWith('[WARN][TestCtx] test message', '');
  });

  it('passes data as second argument', async () => {
    const { createLogger } = await import('@/lib/logger');
    const log = createLogger('TestCtx');
    const data = { key: 'value' };
    log.error('test', data);
    expect(console.error).toHaveBeenCalledWith('[ERROR][TestCtx] test', data);
  });

  it('backward-compat logger uses FRA context', async () => {
    const { logger } = await import('@/lib/logger');
    logger.warn('test message');
    expect(console.warn).toHaveBeenCalledWith('[WARN][FRA] test message', '');
  });

  it('warn and error always log', async () => {
    const { logger } = await import('@/lib/logger');
    logger.warn('warning');
    logger.error('error');
    expect(console.warn).toHaveBeenCalled();
    expect(console.error).toHaveBeenCalled();
  });
});
