import createContextHook from '@nkzw/create-context-hook';
import { useCallback, useEffect, useState } from 'react';
import { authService, type User, type Organisation } from '@/services/auth.service';
import type { KeyPass, EmployeeCount, OrganisationSize, PackageType } from '@/types/assessment';
import { apiService } from '@/services/api.service';
import { API_CONFIG } from '@/constants/api';
import { createLogger } from '@/utils/logger';
import { keyPassAllocation } from '@/constants/packages';
import type { User as AuthUser, Organisation as AuthOrg } from '@/services/auth.service';

// Response interfaces for API calls
interface KeyPassUseResponse {
  user: AuthUser;
  organisation: AuthOrg;
  accessToken: string;
  refreshToken: string;
}

interface KeyPassAllocateResponse {
  codes: string[];
}

// Map backend user/org types to local types
interface UserData extends User {
  keyPassCode?: string;
}
interface OrganisationData extends Organisation {
  employeeBand?: EmployeeCount | null;
  size?: OrganisationSize;
  keyPassesAllocated?: number;
  keyPassesUsed?: number;
}

export const [AuthProvider, useAuth] = createContextHook(() => {
  const logger = createLogger('Auth');
  const [user, setUser] = useState<UserData | null>(null);
  const [organisation, setOrganisation] = useState<OrganisationData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [keyPasses, setKeyPasses] = useState<KeyPass[]>([]);

  useEffect(() => {
    restoreSession();
  }, []);

  /**
   * Restore user session from cached tokens
   */
  const restoreSession = async () => {
    try {
      setIsLoading(true);
      const result = await authService.restoreSession();

      if (result.success && result.user && result.organisation) {
        setUser(result.user);
        setOrganisation(result.organisation as OrganisationData);
        logger.info('Session restored:', result.user.email);
      } else {
        logger.info('No valid session found');
      }
    } catch (error: unknown) {
      logger.error('Failed to restore session:', error);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Sign up a new employer
   */
  const signUp = useCallback(
    async (
      email: string,
      password: string,
      orgName: string
    ): Promise<{ success: boolean; pendingVerification?: boolean; error?: string }> => {
      try {
        logger.info('Signing up:', email);

        const result = await authService.signup({
          email,
          password,
          name: orgName, // Use org name as user name for employers
          organisationName: orgName,
        });

        if (result.success) {
          // Signed in later, after the emailed link confirms the address
          logger.info('Signup successful; waiting for email confirmation');
          return { success: true, pendingVerification: true };
        }

        return {
          success: false,
          error: result.error?.message || 'Failed to create account',
        };
      } catch (error: unknown) {
        logger.error('Signup error:', error);
        return { success: false, error: 'Failed to create account' };
      }
    },
    []
  );

  /**
   * Sign in with email and password
   */
  const signIn = useCallback(
    async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
      try {
        logger.info('Signing in:', email);

        const result = await authService.login({ email, password });

        if (result.success && result.data) {
          setUser(result.data.user);
          setOrganisation(result.data.organisation as OrganisationData);
          logger.info('Login successful');
          return { success: true };
        }

        return {
          success: false,
          error: result.error?.message || 'Invalid email or password',
        };
      } catch (error: unknown) {
        logger.error('Sign in error:', error);
        return { success: false, error: 'Failed to sign in' };
      }
    },
    []
  );

  /**
   * Sign in with key-pass (for employees)
   */
  const signInWithKeyPass = useCallback(
    async (email: string, keyPassCode: string): Promise<{ success: boolean; error?: string }> => {
      try {
        logger.info('Signing in with key-pass');

        const result = await apiService.post<KeyPassUseResponse>(
          API_CONFIG.ENDPOINTS.KEYPASSES.USE,
          { code: keyPassCode, email, name: email.split('@')[0] },
          { requiresAuth: false }
        );

        if (result.success && result.data?.accessToken && result.data?.refreshToken) {
          try {
            await apiService.setTokens(result.data.accessToken, result.data.refreshToken);
          } catch (tokenErr: unknown) {
            logger.error('Failed to persist tokens:', tokenErr);
            return { success: false, error: 'Failed to save credentials' };
          }
        }

        if (result.success && result.data?.user && result.data?.organisation) {
          setUser(result.data.user);
          setOrganisation(result.data.organisation as OrganisationData);
          return { success: true };
        }

        return {
          success: false,
          error: result.error?.message || 'Invalid key-pass code',
        };
      } catch (error: unknown) {
        logger.error('Key-pass sign in error:', error);
        return { success: false, error: 'Failed to validate key-pass' };
      }
    },
    []
  );

  /**
   * Sign out
   */
  const signOut = useCallback(async () => {
    try {
      await authService.logout();
      setUser(null);
      setOrganisation(null);
      setKeyPasses([]);
      logger.info('User signed out');
    } catch (error: unknown) {
      logger.error('Sign out error:', error);
    }
  }, []);

  /**
   * Update organisation data
   */
  const updateOrganisation = useCallback(
    async (updates: Partial<OrganisationData>) => {
      if (!organisation) return;

      try {
        // Update local state immediately for better UX
        const updated: OrganisationData = { ...organisation, ...updates };
        setOrganisation(updated);
        logger.info('Organisation updated locally');

        // The server keeps only the profile fields; it derives the package and key-pass
        // counts from purchases itself and rejects them if sent
        const remote: Record<string, unknown> = {};
        if (updates.name) remote.name = updates.name;
        if (updates.employeeBand) remote.employeeCount = updates.employeeBand;
        if (apiService.isAuthenticated() && Object.keys(remote).length > 0) {
          const response = await apiService.patch(
            `/api/v1/organisations/${organisation.organisationId}`,
            remote,
            { requiresAuth: true }
          );
          if (!response.success) logger.warn('Backend org sync failed', { error: response.error?.message });
        }
      } catch (error: unknown) {
        logger.error('Failed to update organisation:', error);
      }
    },
    [organisation]
  );

  /**
   * Allocate key-passes (after package purchase)
   */
  const allocateKeyPasses = useCallback(
    async (packageType: string, employeeCount: EmployeeCount | null): Promise<{ success: boolean; error?: string }> => {
      if (!organisation) return { success: false, error: 'No organisation found' };

      try {
        logger.info('Allocating key-passes for package:', packageType);

        const allocation = keyPassAllocation(packageType as PackageType, employeeCount);

        const result = await apiService.post<KeyPassAllocateResponse>(
          API_CONFIG.ENDPOINTS.KEYPASSES.ALLOCATE,
          { quantity: allocation, expiresInDays: 90 },
          { requiresAuth: true }
        );

        if (result.success && Array.isArray(result.data?.codes)) {
          setKeyPasses(result.data.codes.map((code: string) => ({ code, status: 'available' } as KeyPass)));
        } else {
          return { success: false, error: result.error?.message || 'Failed to allocate access codes' };
        }

        await updateOrganisation({
          packageType: packageType as PackageType,
          keyPassesAllocated: allocation,
          keyPassesUsed: 0,
          ...(employeeCount ? { employeeBand: employeeCount } : {}),
        });

        logger.info(`Allocated ${allocation} key-passes`);
        return { success: true };
      } catch (error: unknown) {
        logger.error('Failed to allocate key-passes:', error);
        return { success: false, error: 'Failed to allocate access codes' };
      }
    },
    [organisation, updateOrganisation]
  );

  // Codes live on the server; reload them so they survive an app restart
  const refreshKeyPasses = useCallback(async () => {
    const orgId = user?.organisationId;
    if (!orgId) return;
    try {
      const result = await apiService.get<KeyPass[]>(
        `${API_CONFIG.ENDPOINTS.KEYPASSES.BY_ORG(orgId)}?pageSize=200`,
        { requiresAuth: true }
      );
      if (result.success && Array.isArray(result.data)) setKeyPasses(result.data);
    } catch (error: unknown) {
      logger.warn('Could not load key-passes:', error);
    }
  }, [user?.organisationId]);

  return {
    user,
    organisation,
    isLoading,
    isAuthenticated: !!user,
    keyPasses,
    refreshKeyPasses,
    signUp,
    signIn,
    signInWithKeyPass,
    signOut,
    updateOrganisation,
    allocateKeyPasses,
  };
});
