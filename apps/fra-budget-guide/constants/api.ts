import { Platform } from 'react-native';
import { API_DEFAULTS } from '@stopfra/shared/constants';

const getApiBaseUrl = (): string => {
  const envUrl = process.env.EXPO_PUBLIC_API_URL;

  if (__DEV__) {
    if (envUrl) return envUrl;
    if (Platform.OS === 'android') return API_DEFAULTS.ANDROID_EMULATOR_URL;
    return API_DEFAULTS.DEV_URL;
  }

  return envUrl || API_DEFAULTS.PRODUCTION_URL;
};

export const API_CONFIG = {
  BASE_URL: getApiBaseUrl(),
  ENDPOINTS: {
    AUTH: {
      SIGNUP: '/api/v1/auth/signup',
      LOGIN: '/api/v1/auth/login',
      LOGOUT: '/api/v1/auth/logout',
      REFRESH: '/api/v1/auth/refresh',
      ME: '/api/v1/auth/me',
    },
    BUDGET_GUIDE: {
      PROGRESS: '/api/v1/budget-guide/progress',
      PLEDGE: '/api/v1/budget-guide/pledge',
      ANALYTICS: '/api/v1/budget-guide/analytics',
      ORG_ANALYTICS: (orgId: string) => `/api/v1/budget-guide/analytics/org/${orgId}`,
    },
    PURCHASES: {
      CREATE: '/api/v1/purchases',
      CONFIRM: (id: string) => `/api/v1/purchases/${id}/confirm`,
    },
  },
  TIMEOUT: API_DEFAULTS.TIMEOUT,
};

export default API_CONFIG;
