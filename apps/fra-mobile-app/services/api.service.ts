import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { ApiService, createSecureTokenStorage } from '@stopfra/shared/services';
import { API_CONFIG } from '@/constants/api';

// Login tokens go in the Keychain / Keystore; the web build has no secure store
const storage = Platform.OS === 'web' ? AsyncStorage : createSecureTokenStorage(SecureStore, AsyncStorage);

export const apiService = new ApiService({
  baseUrl: API_CONFIG.BASE_URL,
  timeout: API_CONFIG.TIMEOUT,
  refreshEndpoint: API_CONFIG.ENDPOINTS.AUTH.REFRESH,
  storage,
  extraClearKeys: ['organisation'],
});

export default apiService;
