/**
 * Authentication Service
 * Handles user authentication and authorization
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiService } from './api.service';
import { API_CONFIG } from '@/constants/api';
import { createLogger } from '@/utils/logger';

const logger = createLogger('AuthService');

export interface SignupData {
  email: string;
  password: string;
  name: string;
  organisationName: string;
  organisationType?: string;
  organisationSize?: string;
}

export interface LoginData {
  email: string;
  password: string;
}

export interface User {
  userId: string;
  email: string;
  name: string;
  role: 'employer' | 'employee' | 'admin';
  organisationId: string;
  department?: string;
  createdAt: string;
}

export interface Organisation {
  organisationId: string;
  name: string;
  type?: string;
  packageType?: string;
}

export interface AuthResponse {
  user: User;
  organisation: Organisation;
  accessToken: string;
  refreshToken: string;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

class AuthService {
  /**
   * Sign up a new user
   */
  async signup(data: SignupData): Promise<{ success: boolean; data?: AuthResponse; error?: ApiError }> {
    try {
      const response = await apiService.post<AuthResponse>(
        API_CONFIG.ENDPOINTS.AUTH.SIGNUP,
        data as unknown as Record<string, unknown>
      );

      if (response.success && response.data) {
        // Save tokens
        await apiService.setTokens(response.data.accessToken, response.data.refreshToken);

        // Save user and organisation data
        await Promise.all([
          AsyncStorage.setItem('user', JSON.stringify(response.data.user)),
          AsyncStorage.setItem('organisation', JSON.stringify(response.data.organisation)),
        ]);

        return { success: true, data: response.data };
      }

      return { success: false, error: response.error };
    } catch (error: unknown) {
      logger.error('Signup error:', error);
      return {
        success: false,
        error: { code: 'SIGNUP_FAILED', message: 'Failed to create account' },
      };
    }
  }

  /**
   * Log in an existing user
   */
  async login(data: LoginData): Promise<{ success: boolean; data?: AuthResponse; error?: ApiError }> {
    try {
      const response = await apiService.post<AuthResponse>(API_CONFIG.ENDPOINTS.AUTH.LOGIN, data as unknown as Record<string, unknown>);

      if (response.success && response.data) {
        // Save tokens
        await apiService.setTokens(response.data.accessToken, response.data.refreshToken);

        // Save user and organisation data
        await Promise.all([
          AsyncStorage.setItem('user', JSON.stringify(response.data.user)),
          AsyncStorage.setItem('organisation', JSON.stringify(response.data.organisation)),
        ]);

        return { success: true, data: response.data };
      }

      return { success: false, error: response.error };
    } catch (error: unknown) {
      logger.error('Login error:', error);
      return {
        success: false,
        error: { code: 'LOGIN_FAILED', message: 'Failed to log in' },
      };
    }
  }

  /**
   * Log out the current user
   */
  async logout(): Promise<void> {
    try {
      const refreshToken = apiService.getRefreshToken();
      await apiService.post(API_CONFIG.ENDPOINTS.AUTH.LOGOUT, { refreshToken }, { requiresAuth: true });
    } catch (error: unknown) {
      logger.error('Logout API call failed:', error);
    } finally {
      // Always clear local data
      await apiService.clearTokens();
    }
  }

  /**
   * Get current user from API
   */
  async getCurrentUser(): Promise<{ success: boolean; data?: User; error?: ApiError }> {
    try {
      const response = await apiService.get<User>(API_CONFIG.ENDPOINTS.AUTH.ME, {
        requiresAuth: true,
      });

      if (response.success && response.data) {
        // Update cached user data
        await AsyncStorage.setItem('user', JSON.stringify(response.data));
        return { success: true, data: response.data };
      }

      return { success: false, error: response.error };
    } catch (error: unknown) {
      logger.error('Get current user error:', error);
      return {
        success: false,
        error: { code: 'FETCH_USER_FAILED', message: 'Failed to fetch user data' },
      };
    }
  }

  /**
   * Get cached user data
   */
  async getCachedUser(): Promise<User | null> {
    try {
      const userJson = await AsyncStorage.getItem('user');
      return userJson ? JSON.parse(userJson) : null;
    } catch (error: unknown) {
      logger.error('Failed to get cached user:', error);
      return null;
    }
  }

  /**
   * Get cached organisation data
   */
  async getCachedOrganisation(): Promise<Organisation | null> {
    try {
      const orgJson = await AsyncStorage.getItem('organisation');
      return orgJson ? JSON.parse(orgJson) : null;
    } catch (error: unknown) {
      logger.error('Failed to get cached organisation:', error);
      return null;
    }
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return apiService.isAuthenticated();
  }

  /**
   * Restore session from cached tokens
   */
  async restoreSession(): Promise<{ success: boolean; user?: User; organisation?: Organisation }> {
    try {
      const [user, organisation] = await Promise.all([
        this.getCachedUser(),
        this.getCachedOrganisation(),
      ]);

      if (user && organisation) {
        // Verify token is still valid by fetching current user
        const response = await this.getCurrentUser();
        if (response.success) {
          return { success: true, user: response.data, organisation };
        }
      }

      // Session invalid, clear tokens
      await apiService.clearTokens();
      return { success: false };
    } catch (error: unknown) {
      logger.error('Failed to restore session:', error);
      await apiService.clearTokens();
      return { success: false };
    }
  }
}

// Export singleton instance
export const authService = new AuthService();
export default authService;
