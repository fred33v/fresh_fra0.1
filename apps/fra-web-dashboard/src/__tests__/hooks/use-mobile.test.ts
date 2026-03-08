import { renderHook, act } from '@testing-library/react';
import { useIsMobile } from '@/hooks/use-mobile';

// ── Helpers ────────────────────────────────────────────────

function mockMatchMedia(matches: boolean) {
  const listeners: Array<() => void> = [];

  const mql = {
    matches,
    addEventListener: vi.fn((_event: string, cb: () => void) => {
      listeners.push(cb);
    }),
    removeEventListener: vi.fn(),
  } as unknown as MediaQueryList;

  vi.spyOn(window, 'matchMedia').mockReturnValue(mql);

  return { mql, listeners };
}

// ── Tests ──────────────────────────────────────────────────

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useIsMobile', () => {
  it('returns false when window width is >= 768', () => {
    Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true });
    mockMatchMedia(false);

    const { result } = renderHook(() => useIsMobile());

    expect(result.current).toBe(false);
  });

  it('returns true when window width is < 768', () => {
    Object.defineProperty(window, 'innerWidth', { value: 500, writable: true });
    mockMatchMedia(true);

    const { result } = renderHook(() => useIsMobile());

    expect(result.current).toBe(true);
  });

  it('updates when viewport changes', () => {
    Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true });
    const { listeners } = mockMatchMedia(false);

    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);

    // Simulate resize to mobile
    Object.defineProperty(window, 'innerWidth', { value: 500, writable: true });
    act(() => {
      listeners.forEach((cb) => cb());
    });

    expect(result.current).toBe(true);
  });

  it('cleans up event listener on unmount', () => {
    Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true });
    const { mql } = mockMatchMedia(false);

    const { unmount } = renderHook(() => useIsMobile());
    unmount();

    expect(mql.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function));
  });

  it('calls matchMedia with correct breakpoint query', () => {
    Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true });
    mockMatchMedia(false);

    renderHook(() => useIsMobile());

    expect(window.matchMedia).toHaveBeenCalledWith('(max-width: 767px)');
  });
});
