import { debounce } from '../../utils/debounce';

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('debounce', () => {
  it('calls the function after the wait period', () => {
    const fn = jest.fn();
    const debounced = debounce(fn, 200);

    debounced();
    expect(fn).not.toHaveBeenCalled();

    jest.advanceTimersByTime(200);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('only calls once when invoked multiple times within wait', () => {
    const fn = jest.fn();
    const debounced = debounce(fn, 100);

    debounced();
    debounced();
    debounced();

    jest.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('resets the timer on each call', () => {
    const fn = jest.fn();
    const debounced = debounce(fn, 100);

    debounced();
    jest.advanceTimersByTime(80);
    expect(fn).not.toHaveBeenCalled();

    debounced(); // reset timer
    jest.advanceTimersByTime(80);
    expect(fn).not.toHaveBeenCalled();

    jest.advanceTimersByTime(20);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('passes arguments to the debounced function', () => {
    const fn = jest.fn();
    const debounced = debounce(fn, 50);

    debounced('hello', 42);
    jest.advanceTimersByTime(50);

    expect(fn).toHaveBeenCalledWith('hello', 42);
  });

  it('uses the last call arguments when called multiple times', () => {
    const fn = jest.fn();
    const debounced = debounce(fn, 50);

    debounced('first');
    debounced('second');
    debounced('third');

    jest.advanceTimersByTime(50);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('third');
  });

  it('can be called again after the wait period', () => {
    const fn = jest.fn();
    const debounced = debounce(fn, 50);

    debounced('a');
    jest.advanceTimersByTime(50);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('a');

    debounced('b');
    jest.advanceTimersByTime(50);
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenLastCalledWith('b');
  });

  it('does not call the function if wait has not elapsed', () => {
    const fn = jest.fn();
    const debounced = debounce(fn, 500);

    debounced();
    jest.advanceTimersByTime(499);
    expect(fn).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
