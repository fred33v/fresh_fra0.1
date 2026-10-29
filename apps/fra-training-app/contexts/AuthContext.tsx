import createContextHook from '@nkzw/create-context-hook';
import { useCallback, useEffect, useState } from 'react';
import { apiService } from '@/services/api.service';
import { API_CONFIG } from '@/constants/api';
import { createLogger } from '@/utils/logger';
import { keyPassErrorMessage } from '@stopfra/shared';
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

  const startSession = useCallback(async (data: KeyPassResponse) => {
    await apiService.setTokens(data.accessToken, data.refreshToken);
    setAccessToken(data.accessToken);
    setRefreshToken(data.refreshToken);
    setUser(data.user);
  }, []);

  // First visit: the key-pass creates the account. It works once, so the employee chooses a password too.
  const loginWithKeyPass = useCallback(
    async (code: string, email: string, password: string): Promise<{ success: boolean; error?: string }> => {
      try {
        const result = await apiService.post<KeyPassResponse>(API_CONFIG.ENDPOINTS.KEYPASSES.USE, {
          code,
          email,
          password,
        });

        if (result.success && result.data?.accessToken && result.data?.refreshToken) {
          await startSession(result.data);
          return { success: true };
        }

        return {
          success: false,
          error: keyPassErrorMessage(result.error),
        };
      } catch (error: unknown) {
        logger.error('Key-pass login failed', error);
        return { success: false, error: 'Failed to authenticate with key-pass' };
      }
    },
    [startSession]
  );

  // Later visits: sign in with the email and password chosen when joining
  const loginWithPassword = useCallback(
    async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
      try {
        const result = await apiService.post<KeyPassResponse>(API_CONFIG.ENDPOINTS.AUTH.LOGIN, { email, password });

        if (result.success && result.data?.accessToken && result.data?.refreshToken) {
          await startSession(result.data);
          return { success: true };
        }

        return {
          success: false,
          error: result.error?.message || 'Email or password is incorrect',
        };
      } catch (error: unknown) {
        logger.error('Password login failed', error);
        return { success: false, error: 'Failed to sign in' };
      }
    },
    [startSession]
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
    loginWithPassword,
    signOut,
  };
});
