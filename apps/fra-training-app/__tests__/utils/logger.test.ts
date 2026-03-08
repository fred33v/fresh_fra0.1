import { createLogger } from '@/utils/logger';

describe('logger', () => {
  // The logger uses __DEV__ to set MIN_LEVEL. In test env __DEV__ is undefined,
  // so MIN_LEVEL = 'warn', meaning only warn/error will log.

  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('creates logger with all methods', () => {
    const logger = createLogger('Test');
    expect(logger.debug).toBeInstanceOf(Function);
    expect(logger.info).toBeInstanceOf(Function);
    expect(logger.warn).toBeInstanceOf(Function);
    expect(logger.error).toBeInstanceOf(Function);
  });

  it('error calls console.error with formatted message', () => {
    const logger = createLogger('MyContext');
    logger.error('something failed', { detail: 'x' });
    expect(console.error).toHaveBeenCalledWith('[ERROR][MyContext] something failed', { detail: 'x' });
  });

  it('warn calls console.warn with formatted message', () => {
    const logger = createLogger('MyContext');
    logger.warn('something suspicious');
    expect(console.warn).toHaveBeenCalledWith('[WARN][MyContext] something suspicious', '');
  });

  it('debug does not log when MIN_LEVEL is warn', () => {
    const logger = createLogger('Test');
    logger.debug('debug message');
    expect(console.log).not.toHaveBeenCalled();
  });

  it('info does not log when MIN_LEVEL is warn', () => {
    const logger = createLogger('Test');
    logger.info('info message');
    expect(console.log).not.toHaveBeenCalled();
  });
});
