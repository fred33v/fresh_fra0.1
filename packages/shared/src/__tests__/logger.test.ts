import { describe, it, expect, vitest } from 'vitest';

// The logger reads __DEV__ at import time; simulate a React Native dev build
// so debug/info output is enabled for these tests.
vitest.hoisted(() => {
  (globalThis as { __DEV__?: boolean }).__DEV__ = true;
});

import { createLogger } from '../logger';

describe('createLogger', () => {
  it('creates a logger with context', () => {
    const logger = createLogger('TestContext');
    expect(logger).toBeDefined();
    expect(logger.debug).toBeDefined();
    expect(logger.info).toBeDefined();
    expect(logger.warn).toBeDefined();
    expect(logger.error).toBeDefined();
  });

  it('has all required methods', () => {
    const logger = createLogger('Test');
    expect(typeof logger.debug).toBe('function');
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.error).toBe('function');
  });

  it('calls console methods with formatted context', () => {
    const consoleSpy = vitest.spyOn(console, 'log').mockImplementation(() => {});
    const logger = createLogger('MyContext');
    
    logger.debug('test message', { data: 'value' });
    
    expect(consoleSpy).toHaveBeenCalled();
    const call = consoleSpy.mock.calls[0];
    expect(call[0]).toContain('[DEBUG]');
    expect(call[0]).toContain('[MyContext]');
    expect(call[0]).toContain('test message');
    
    consoleSpy.mockRestore();
  });

  it('logs info messages, warn messages, and error messages', () => {
    const infoSpy = vitest.spyOn(console, 'log').mockImplementation(() => {});
    const warnSpy = vitest.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = vitest.spyOn(console, 'error').mockImplementation(() => {});
    
    const logger = createLogger('TestLog');
    
    logger.info('info msg');
    logger.warn('warn msg');
    logger.error('error msg');
    
    expect(infoSpy).toHaveBeenCalledWith(expect.stringContaining('[INFO]'), '');
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('[WARN]'), '');
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('[ERROR]'), '');
    
    infoSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('handles optional data parameter', () => {
    const consoleSpy = vitest.spyOn(console, 'log').mockImplementation(() => {});
    const logger = createLogger('Test');
    
    logger.info('without data');
    logger.info('with data', { key: 'value' });
    
    const calls = consoleSpy.mock.calls;
    expect(calls[0][1]).toBe('');
    expect(calls[1][1]).toEqual({ key: 'value' });
    
    consoleSpy.mockRestore();
  });

  it('multiple loggers can have different contexts', () => {
    const logger1 = createLogger('Context1');
    const logger2 = createLogger('Context2');
    
    const consoleSpy = vitest.spyOn(console, 'log').mockImplementation(() => {});
    
    logger1.debug('msg1');
    logger2.debug('msg2');
    
    const calls = consoleSpy.mock.calls;
    expect(calls[0][0]).toContain('[Context1]');
    expect(calls[1][0]).toContain('[Context2]');
    
    consoleSpy.mockRestore();
  });

  it('only logs warn and error outside dev builds', async () => {
    const g = globalThis as { __DEV__?: boolean };
    g.__DEV__ = false;
    vitest.resetModules();
    const { createLogger: createProdLogger } = await import('../logger');

    const logSpy = vitest.spyOn(console, 'log').mockImplementation(() => {});
    const warnSpy = vitest.spyOn(console, 'warn').mockImplementation(() => {});

    const logger = createProdLogger('Prod');
    logger.debug('debug msg');
    logger.info('info msg');
    logger.warn('warn msg');

    expect(logSpy).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('[WARN]'), '');

    logSpy.mockRestore();
    warnSpy.mockRestore();
    g.__DEV__ = true;
  });
});
