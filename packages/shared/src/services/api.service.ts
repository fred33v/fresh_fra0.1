/**
 * Shared API Service
 * Platform-agnostic HTTP client with token management.
 * Uses dependency injection for storage (apps pass AsyncStorage or similar).
 */

import { createLogger } from '../logger';
import type { ApiResponse, ApiRequestOptions } from '@stopfra/types';

const logger = createLogger('ApiService');

/** Storage interface for token persistence (AsyncStorage-compatible). */
export interface TokenStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

/** Configuration for creating an ApiService instance. */
export interface ApiServiceConfig {
  baseUrl: string;
  timeout?: number;
  refreshEndpoint: string;
  storage: TokenStorage;
  /** Additional storage keys to clear on logout (e.g. ['organisation']). */
  extraClearKeys?: string[];
}

export class ApiService {
  private baseUrl: string;
  private timeout: number;
  private refreshEndpoint: string;
  private storage: TokenStorage;
  private extraClearKeys: string[];
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private tokensLoadedPromise: Promise<void>;
  private refreshPromise: Promise<boolean> | null = null;

  constructor(config: ApiServiceConfig) {
    this.baseUrl = config.baseUrl;
    this.timeout = config.timeout ?? 30000;
    this.refreshEndpoint = config.refreshEndpoint;
    this.storage = config.storage;
    this.extraClearKeys = config.extraClearKeys ?? [];
    this.tokensLoadedPromise = this.loadTokens();
  }

  private async ensureTokensLoaded(): Promise<void> {
    await this.tokensLoadedPromise;
  }

  private async loadTokens(): Promise<void> {
    try {
      const [accessToken, refreshToken] = await Promise.all([
        this.storage.getItem('accessToken'),
        this.storage.getItem('refreshToken'),
      ]);
      this.accessToken = accessToken;
      this.refreshToken = refreshToken;
    } catch (error: unknown) {
      logger.error('Failed to load tokens', error);
    }
  }

  private async saveTokens(accessToken: string, refreshToken: string): Promise<void> {
    try {
      this.accessToken = accessToken;
      this.refreshToken = refreshToken;
      await Promise.all([
        this.storage.setItem('accessToken', accessToken),
        this.storage.setItem('refreshToken', refreshToken),
      ]);
    } catch (error: unknown) {
      logger.error('Failed to save tokens', error);
      throw error;
    }
  }

  getRefreshToken(): string | null {
    return this.refreshToken;
  }

  async clearTokens(): Promise<void> {
    this.accessToken = null;
    this.refreshToken = null;
    const keysToRemove = ['accessToken', 'refreshToken', 'user', ...this.extraClearKeys];
    await Promise.all(keysToRemove.map((key) => this.storage.removeItem(key)));
  }

  private async makeRequest<T>(
    endpoint: string,
    options: ApiRequestOptions = {}
  ): Promise<ApiResponse<T>> {
    await this.ensureTokensLoaded();
    const {
      requiresAuth = false,
      timeout = this.timeout,
      headers = {},
      ...fetchOptions
    } = options;

    const url = `${this.baseUrl}${endpoint}`;

    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(headers as Record<string, string>),
    };

    if (requiresAuth && this.accessToken) {
      requestHeaders['Authorization'] = `Bearer ${this.accessToken}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...fetchOptions,
        headers: requestHeaders,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.status === 401 && requiresAuth && this.refreshToken && !options?.retried) {
        const refreshed = await this.refreshAccessToken();
        if (refreshed) {
          return this.makeRequest<T>(endpoint, { ...options, retried: true });
        }
      }

      let data: ApiResponse<T>;
      try {
        data = await response.json();
      } catch {
        return {
          success: false,
          error: {
            code: 'PARSE_ERROR',
            message: `Request failed with status ${response.status} (non-JSON response)`,
          },
        };
      }

      if (!response.ok) {
        return {
          success: false,
          error: data.error || {
            code: 'HTTP_ERROR',
            message: `Request failed with status ${response.status}`,
          },
        };
      }

      return data;
    } catch (error: unknown) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === 'AbortError') {
        return {
          success: false,
          error: {
            code: 'TIMEOUT',
            message: 'Request timed out',
          },
        };
      }

      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: error instanceof Error ? error.message : 'Network request failed',
        },
      };
    }
  }

  private async refreshAccessToken(): Promise<boolean> {
    // Mutex: if a refresh is already in flight, wait for it instead of issuing a duplicate
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    if (!this.refreshToken) {
      return false;
    }

    this.refreshPromise = this.doRefresh();
    try {
      return await this.refreshPromise;
    } finally {
      this.refreshPromise = null;
    }
  }

  private async doRefresh(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}${this.refreshEndpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken: this.refreshToken }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data.accessToken && data.data.refreshToken) {
          this.accessToken = data.data.accessToken;
          this.refreshToken = data.data.refreshToken;
          await Promise.all([
            this.storage.setItem('accessToken', data.data.accessToken),
            this.storage.setItem('refreshToken', data.data.refreshToken),
          ]);
          return true;
        }
      }

      await this.clearTokens();
      return false;
    } catch (error: unknown) {
      logger.error('Token refresh failed', error);
      await this.clearTokens();
      return false;
    }
  }

  async get<T>(endpoint: string, options?: ApiRequestOptions): Promise<ApiResponse<T>> {
    return this.makeRequest<T>(endpoint, {
      method: 'GET',
      ...options,
    });
  }

  async post<T>(
    endpoint: string,
    data?: Record<string, unknown>,
    options?: ApiRequestOptions
  ): Promise<ApiResponse<T>> {
    return this.makeRequest<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
      ...options,
    });
  }

  async patch<T>(
    endpoint: string,
    data?: Record<string, unknown>,
    options?: ApiRequestOptions
  ): Promise<ApiResponse<T>> {
    return this.makeRequest<T>(endpoint, {
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
      ...options,
    });
  }

  async delete<T>(endpoint: string, options?: ApiRequestOptions): Promise<ApiResponse<T>> {
    return this.makeRequest<T>(endpoint, {
      method: 'DELETE',
      ...options,
    });
  }

  async setTokens(accessToken: string, refreshToken: string): Promise<void> {
    await this.saveTokens(accessToken, refreshToken);
  }

  isAuthenticated(): boolean {
    return !!this.accessToken;
  }

  getAccessToken(): string | null {
    return this.accessToken;
  }
}
