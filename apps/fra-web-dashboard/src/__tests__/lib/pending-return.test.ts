import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearPendingReturn, pendingReturn, rememberReturn } from '@/lib/pending-return';

// The shared test setup stubs localStorage with no-ops, so give this file a real in-memory one
const store = new Map<string, string>();
const memoryStorage = {
  getItem: vi.fn((key: string) => store.get(key) ?? null),
  setItem: vi.fn((key: string, value: string) => void store.set(key, value)),
  removeItem: vi.fn((key: string) => void store.delete(key)),
};
Object.defineProperty(window, 'localStorage', { value: memoryStorage, configurable: true });

afterEach(() => {
  store.clear();
  memoryStorage.getItem.mockClear();
});

describe('pending return', () => {
  it('remembers a same-site path across the email hop and clears it', () => {
    rememberReturn('/provider-application');
    expect(pendingReturn()).toBe('/provider-application');
    clearPendingReturn();
    expect(pendingReturn()).toBeNull();
  });

  it.each(['https://evil.example/x', '//evil.example', '/\\evil', '/auth?mode=signup', '', null])(
    'refuses %s',
    (value) => {
      rememberReturn(value);
      expect(pendingReturn()).toBeNull();
    },
  );

  it('forgets after a day, and ignores a stored time in the future', () => {
    rememberReturn('/provider-application');
    expect(pendingReturn(Date.now() + 25 * 60 * 60 * 1000)).toBeNull();
    expect(pendingReturn(Date.now() - 60_000)).toBeNull();
  });

  it('ignores tampered storage', () => {
    store.set('fra.pendingReturn', JSON.stringify({ path: 'https://evil.example', at: Date.now() }));
    expect(pendingReturn()).toBeNull();
    store.set('fra.pendingReturn', '{not json');
    expect(pendingReturn()).toBeNull();
  });

  it('does not throw when storage is unavailable', () => {
    memoryStorage.setItem.mockImplementationOnce(() => {
      throw new Error('blocked');
    });
    memoryStorage.getItem.mockImplementationOnce(() => {
      throw new Error('blocked');
    });
    expect(() => rememberReturn('/provider-application')).not.toThrow();
    expect(pendingReturn()).toBeNull();
  });
});
