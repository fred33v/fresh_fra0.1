import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, ReactNode } from 'react';
import { api, setTokens, clearTokens, hasStoredTokens, getRefreshToken } from '@/lib/api';
import { createLogger } from '@/lib/logger';
const logger = createLogger('Auth');
import { Profile, AppRole } from '@/types/workshop';

export interface AuthUser {
  userId: string;
  email: string;
  name: string;
  role: string;
  organisationId: string;
  createdAt: string;
}

interface AuthContextType {
  user: AuthUser | null;
  profile: Profile | null;
  roles: AppRole[];
  isLoading: boolean;
  signUp: (email: string, password: string, metadata: SignUpMetadata) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  hasRole: (role: AppRole) => boolean;
  refreshProfile: () => Promise<void>;
}

interface SignUpMetadata {
  full_name: string;
  organization_name: string;
  sector: 'public' | 'charity' | 'private';
  job_title?: string;
}

type MeResponse = AuthUser & {
  profile: {
    id: string;
    user_id: string;
    full_name: string;
    organization_name: string;
    sector: 'public' | 'charity' | 'private';
    job_title: string | null;
    created_at: string;
    updated_at: string;
  } | null;
  workshopRoles: string[];
};

type AuthResponse = {
  user: AuthUser;
  organisation: { organisationId: string; name: string };
  accessToken: string;
  refreshToken: string;
  profile?: {
    id: string;
    user_id: string;
    full_name: string;
    organization_name: string;
    sector: 'public' | 'charity' | 'private';
    job_title: string | null;
    created_at: string;
    updated_at: string;
  } | null;
  workshopRoles?: string[];
};

function mapProfile(raw: MeResponse['profile']): Profile | null {
  if (!raw) return null;
  return {
    id: raw.id,
    user_id: raw.user_id,
    full_name: raw.full_name,
    organization_name: raw.organization_name,
    sector: raw.sector,
    job_title: raw.job_title,
    created_at: raw.created_at,
    updated_at: raw.updated_at,
  };
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const isMountedRef = useRef(true);

  const hydrateFromMe = async () => {
    try {
      const data = await api.get<MeResponse>('/api/v1/auth/me');
      if (!isMountedRef.current) return;
      setUser({
        userId: data.userId,
        email: data.email,
        name: data.name,
        role: data.role,
        organisationId: data.organisationId,
        createdAt: data.createdAt,
      });
      setProfile(mapProfile(data.profile));
      setRoles((data.workshopRoles ?? []) as AppRole[]);
    } catch (err: unknown) {
      if (!isMountedRef.current) return;
      logger.warn('Failed to hydrate session, clearing tokens', err);
      clearTokens();
      setUser(null);
      setProfile(null);
      setRoles([]);
    }
  };

  const refreshProfile = useCallback(async () => {
    if (hasStoredTokens()) {
      await hydrateFromMe();
    }
  }, []);

  useEffect(() => {
    if (hasStoredTokens()) {
      hydrateFromMe().finally(() => {
        if (isMountedRef.current) setIsLoading(false);
      });
    } else {
      setIsLoading(false);
    }

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const signUp = useCallback(async (email: string, password: string, metadata: SignUpMetadata) => {
    try {
      const data = await api.post<AuthResponse>('/api/v1/auth/signup', {
        email,
        password,
        name: metadata.full_name,
        organisationName: metadata.organization_name,
        jobTitle: metadata.job_title,
        sector: metadata.sector,
        workshopRole: 'participant',
      });

      setTokens(data.accessToken, data.refreshToken);
      setUser(data.user);
      if (data.profile) setProfile(mapProfile(data.profile));
      setRoles((data.workshopRoles ?? ['participant']) as AppRole[]);

      return { error: null };
    } catch (err: unknown) {
      return { error: err as Error };
    }
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      const data = await api.post<AuthResponse>('/api/v1/auth/login', {
        email,
        password,
      });

      setTokens(data.accessToken, data.refreshToken);
      setUser(data.user);

      // Fetch full profile+roles via /me after login
      await hydrateFromMe();

      return { error: null };
    } catch (err: unknown) {
      return { error: err as Error };
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      const refreshToken = getRefreshToken();
      await api.post('/api/v1/auth/logout', { refreshToken });
    } catch (err: unknown) {
      logger.warn('Logout request failed (tokens cleared locally)', err);
    }
    clearTokens();
    setUser(null);
    setProfile(null);
    setRoles([]);
  }, []);

  const hasRole = useCallback((role: AppRole) => roles.includes(role), [roles]);

  const value = useMemo(() => ({
    user,
    profile,
    roles,
    isLoading,
    signUp,
    signIn,
    signOut,
    hasRole,
    refreshProfile,
  }), [user, profile, roles, isLoading, signUp, signIn, signOut, hasRole, refreshProfile]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
