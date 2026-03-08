import React from 'react';
import { renderHook, act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock @nkzw/create-context-hook to avoid ESM transform issues
jest.mock('@nkzw/create-context-hook', () => {
  const { createContext, useContext } = require('react');
  return {
    __esModule: true,
    default: (contextInitializer: () => any) => {
      const Context = createContext(undefined);
      const Provider = ({ children }: { children: React.ReactNode }) => {
        const React = require('react');
        return React.createElement(Context.Provider, { value: contextInitializer() }, children);
      };
      const useHook = () => useContext(Context);
      return [Provider, useHook];
    },
  };
});

import { AppContext, useApp } from '@/contexts/AppContext';

// AppContext is the provider component
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AppContext>{children}</AppContext>
);

describe('AppContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset AsyncStorage mock returns
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
  });

  it('provides initial state', async () => {
    const { result } = renderHook(() => useApp(), { wrapper });
    // Wait for loadData to finish
    await act(async () => {});
    expect(result.current.selectedRoles).toEqual([]);
    expect(result.current.watchItems).toEqual([]);
    expect(result.current.pledge).toBeNull();
    expect(result.current.completedChannels).toEqual([]);
  });

  it('updateRoles updates state and persists', async () => {
    const { result } = renderHook(() => useApp(), { wrapper });
    await act(async () => {});

    await act(async () => {
      await result.current.updateRoles(['procurement']);
    });

    expect(result.current.selectedRoles).toEqual(['procurement']);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('selectedRoles', JSON.stringify(['procurement']));
  });

  it('toggleWatchItem adds and removes items', async () => {
    const { result } = renderHook(() => useApp(), { wrapper });
    await act(async () => {});

    const item = { id: 'w1', category: 'people' as const, text: 'Suspicious activity' };

    // Add
    await act(async () => {
      await result.current.toggleWatchItem(item);
    });
    expect(result.current.watchItems).toHaveLength(1);
    expect(result.current.isWatched('w1')).toBe(true);

    // Remove
    await act(async () => {
      await result.current.toggleWatchItem(item);
    });
    expect(result.current.watchItems).toHaveLength(0);
    expect(result.current.isWatched('w1')).toBe(false);
  });

  it('savePledge stores pledge with timestamp', async () => {
    const { result } = renderHook(() => useApp(), { wrapper });
    await act(async () => {});

    await act(async () => {
      await result.current.savePledge('John Doe');
    });

    expect(result.current.pledge).toBeTruthy();
    expect(result.current.pledge?.signature).toBe('John Doe');
    expect(result.current.pledge?.timestamp).toBeTruthy();
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('pledge', expect.any(String));
  });

  it('toggleCompletedChannel adds and removes channels', async () => {
    const { result } = renderHook(() => useApp(), { wrapper });
    await act(async () => {});

    await act(async () => {
      await result.current.toggleCompletedChannel('legal');
    });
    expect(result.current.isChannelCompleted('legal')).toBe(true);

    await act(async () => {
      await result.current.toggleCompletedChannel('legal');
    });
    expect(result.current.isChannelCompleted('legal')).toBe(false);
  });

  it('updateContactDetail updates specific key', async () => {
    const { result } = renderHook(() => useApp(), { wrapper });
    await act(async () => {});

    await act(async () => {
      await result.current.updateContactDetail('fraudRiskOwner', 'Jane Smith');
    });

    expect(result.current.contactDetails.fraudRiskOwner).toBe('Jane Smith');
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('contactDetails', expect.any(String));
  });

  it('loads saved data from AsyncStorage', async () => {
    (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
      const data: Record<string, string> = {
        selectedRoles: JSON.stringify(['procurement', 'payroll']),
        watchItems: JSON.stringify([{ id: 'w1', category: 'people', text: 'Test' }]),
      };
      return Promise.resolve(data[key] ?? null);
    });

    const { result } = renderHook(() => useApp(), { wrapper });
    await act(async () => {});

    expect(result.current.selectedRoles).toEqual(['procurement', 'payroll']);
    expect(result.current.watchItems).toHaveLength(1);
  });
});
