import { renderHook, act } from '@testing-library/react';
import { reducer, useToast, toast } from '@/hooks/use-toast';

// ── Reducer tests (pure function) ─────────────────────────

describe('use-toast reducer', () => {
  const emptyState = { toasts: [] };

  describe('ADD_TOAST', () => {
    it('adds a toast to the beginning of the array', () => {
      const newToast = { id: '1', title: 'Hello', open: true };
      const result = reducer(emptyState, { type: 'ADD_TOAST', toast: newToast });

      expect(result.toasts).toHaveLength(1);
      expect(result.toasts[0]).toEqual(newToast);
    });

    it('prepends new toast before existing ones', () => {
      const existing = { id: '1', title: 'First', open: true };
      const state = { toasts: [existing] };
      const newToast = { id: '2', title: 'Second', open: true };

      const result = reducer(state, { type: 'ADD_TOAST', toast: newToast });

      // TOAST_LIMIT is 1, so only the newest toast remains
      expect(result.toasts).toHaveLength(1);
      expect(result.toasts[0].id).toBe('2');
    });

    it('enforces TOAST_LIMIT of 1', () => {
      const state = { toasts: [{ id: '1', title: 'A', open: true }] };
      const result = reducer(state, {
        type: 'ADD_TOAST',
        toast: { id: '2', title: 'B', open: true },
      });

      expect(result.toasts).toHaveLength(1);
      expect(result.toasts[0].title).toBe('B');
    });
  });

  describe('UPDATE_TOAST', () => {
    it('updates a toast by id', () => {
      const state = { toasts: [{ id: '1', title: 'Old', open: true }] };
      const result = reducer(state, {
        type: 'UPDATE_TOAST',
        toast: { id: '1', title: 'New' },
      });

      expect(result.toasts[0].title).toBe('New');
      expect(result.toasts[0].open).toBe(true);
    });

    it('does not modify other toasts', () => {
      const state = {
        toasts: [{ id: '1', title: 'Keep', open: true }],
      };
      const result = reducer(state, {
        type: 'UPDATE_TOAST',
        toast: { id: '99', title: 'Other' },
      });

      expect(result.toasts[0].title).toBe('Keep');
    });
  });

  describe('DISMISS_TOAST', () => {
    it('sets open to false for a specific toast', () => {
      const state = { toasts: [{ id: '1', title: 'Msg', open: true }] };
      const result = reducer(state, { type: 'DISMISS_TOAST', toastId: '1' });

      expect(result.toasts[0].open).toBe(false);
    });

    it('sets open to false for all toasts when no id provided', () => {
      const state = {
        toasts: [{ id: '1', title: 'A', open: true }],
      };
      const result = reducer(state, { type: 'DISMISS_TOAST' });

      expect(result.toasts.every((t) => t.open === false)).toBe(true);
    });
  });

  describe('REMOVE_TOAST', () => {
    it('removes a specific toast by id', () => {
      const state = { toasts: [{ id: '1', title: 'Msg', open: true }] };
      const result = reducer(state, { type: 'REMOVE_TOAST', toastId: '1' });

      expect(result.toasts).toHaveLength(0);
    });

    it('removes all toasts when no id provided', () => {
      const state = {
        toasts: [{ id: '1', title: 'A', open: true }],
      };
      const result = reducer(state, { type: 'REMOVE_TOAST' });

      expect(result.toasts).toHaveLength(0);
    });

    it('keeps other toasts when removing by id', () => {
      const state = {
        toasts: [{ id: '1', title: 'Keep', open: true }],
      };
      const result = reducer(state, { type: 'REMOVE_TOAST', toastId: '99' });

      expect(result.toasts).toHaveLength(1);
    });
  });
});

// ── toast() function tests ────────────────────────────────

describe('toast()', () => {
  it('returns an object with id, dismiss, and update', () => {
    const result = toast({ title: 'Test' });

    expect(result).toHaveProperty('id');
    expect(typeof result.dismiss).toBe('function');
    expect(typeof result.update).toBe('function');
  });

  it('generates unique ids', () => {
    const t1 = toast({ title: 'First' });
    const t2 = toast({ title: 'Second' });

    expect(t1.id).not.toBe(t2.id);
  });
});

// ── useToast() hook tests ─────────────────────────────────

describe('useToast()', () => {
  it('returns toast function and dismiss function', () => {
    const { result } = renderHook(() => useToast());

    expect(typeof result.current.toast).toBe('function');
    expect(typeof result.current.dismiss).toBe('function');
    expect(Array.isArray(result.current.toasts)).toBe(true);
  });

  it('adds toast to state when toast() is called', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.toast({ title: 'Hello' });
    });

    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].title).toBe('Hello');
    expect(result.current.toasts[0].open).toBe(true);
  });

  it('dismiss sets toast open to false', () => {
    const { result } = renderHook(() => useToast());

    let toastId: string;
    act(() => {
      const t = result.current.toast({ title: 'Dismiss me' });
      toastId = t.id;
    });

    act(() => {
      result.current.dismiss(toastId!);
    });

    const found = result.current.toasts.find((t) => t.id === toastId!);
    expect(found?.open).toBe(false);
  });
});
