import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiService } from '@stopfra/shared/services';
import { API_CONFIG } from '@/constants/api';

export const apiService = new ApiService({
  baseUrl: API_CONFIG.BASE_URL,
  timeout: API_CONFIG.TIMEOUT,
  refreshEndpoint: API_CONFIG.ENDPOINTS.AUTH.REFRESH,
  storage: AsyncStorage,
  extraClearKeys: ['organisation'],
});

export default apiService;
