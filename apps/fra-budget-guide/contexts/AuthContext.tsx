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

interface AuthTokenResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export const [AuthProvider, useAuth] = createContextHook(() => {
  const [user, setUser] = useState<User | null>(null);
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

  const signIn = useCallback(
    async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
      try {
        const result = await apiService.post<AuthTokenResponse>(API_CONFIG.ENDPOINTS.AUTH.LOGIN, {
          email,
          password,
        });

        if (result.success && result.data?.accessToken && result.data?.refreshToken) {
          await apiService.setTokens(result.data.accessToken, result.data.refreshToken);
          setUser(result.data.user);
          return { success: true };
        }

        return {
          success: false,
          error: result.error?.message || 'Invalid email or password',
        };
      } catch (error: unknown) {
        logger.error('Sign in failed', error);
        return { success: false, error: 'Failed to sign in' };
      }
    },
    []
  );

  const signUp = useCallback(
    async (
      email: string,
      password: string,
      name: string,
      organisationName: string
    ): Promise<{ success: boolean; error?: string }> => {
      try {
        const result = await apiService.post<AuthTokenResponse>(API_CONFIG.ENDPOINTS.AUTH.SIGNUP, {
          email,
          password,
          name,
          organisationName,
        });

        if (result.success && result.data?.accessToken && result.data?.refreshToken) {
          await apiService.setTokens(result.data.accessToken, result.data.refreshToken);
          setUser(result.data.user);
          return { success: true };
        }

        return {
          success: false,
          error: result.error?.message || 'Failed to create account',
        };
      } catch (error: unknown) {
        logger.error('Sign up failed', error);
        return { success: false, error: 'Failed to create account' };
      }
    },
    []
  );

  const signOut = useCallback(async () => {
    try {
      const currentRefreshToken = apiService.getRefreshToken();
      await apiService.post(API_CONFIG.ENDPOINTS.AUTH.LOGOUT, { refreshToken: currentRefreshToken }, {
        requiresAuth: true,
      });
    } catch {
      // Ignore logout API errors
    }
    await apiService.clearTokens();
    setUser(null);
  }, []);

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    signIn,
    signUp,
    signOut,
  };
});
