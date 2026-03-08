import createContextHook from '@nkzw/create-context-hook';
import { useCallback, useEffect, useState } from 'react';
import { apiService } from '@/services/api.service';
import { API_CONFIG } from '@/constants/api';
import { createLogger } from '@/utils/logger';
const logger = createLogger('AuthContext');

interface User {
  userId: string;
  email: string;
  name: string;
  role: string;
  organisationId: string;
}

interface AuthMeResponse {
  userId: string;
  email: string;
  name: string;
  role: string;
  organisationId: string;
}

interface KeyPassResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export const [AuthProvider, useAuth] = createContextHook(() => {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    restoreSession();
  }, []);

  const restoreSession = async () => {
    try {
      setIsLoading(true);
      if (!apiService.isAuthenticated()) {
        return;
      }

      const result = await apiService.get<AuthMeResponse>(API_CONFIG.ENDPOINTS.AUTH.ME, {
        requiresAuth: true,
      });

      if (result.success && result.data) {
        setUser(result.data);
      }
    } catch (error: unknown) {
      logger.error('Failed to restore session', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithKeyPass = useCallback(
    async (code: string): Promise<{ success: boolean; error?: string }> => {
      try {
        const result = await apiService.post<KeyPassResponse>(API_CONFIG.ENDPOINTS.KEYPASSES.USE, {
          code,
        });

        if (result.success && result.data?.accessToken && result.data?.refreshToken) {
          await apiService.setTokens(result.data.accessToken, result.data.refreshToken);
          setAccessToken(result.data.accessToken);
          setRefreshToken(result.data.refreshToken);
          setUser(result.data.user);
          return { success: true };
        }

        return {
          success: false,
          error: result.error?.message || 'Invalid key-pass code',
        };
      } catch (error: unknown) {
        logger.error('Key-pass login failed', error);
        return { success: false, error: 'Failed to authenticate with key-pass' };
      }
    },
    []
  );

  const signOut = useCallback(async () => {
    try {
      await apiService.post(API_CONFIG.ENDPOINTS.AUTH.LOGOUT, { refreshToken }, {
        requiresAuth: true,
      });
    } catch {
      // Ignore logout API errors
    }
    await apiService.clearTokens();
    setAccessToken(null);
    setRefreshToken(null);
    setUser(null);
  }, [refreshToken]);

  return {
    user,
    accessToken,
    refreshToken,
    isLoading,
    isAuthenticated: !!user,
    loginWithKeyPass,
    signOut,
  };
});
