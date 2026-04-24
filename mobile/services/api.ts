import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import * as SecureStore from 'expo-secure-store';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api';

const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config as AxiosRequestConfig & { _retry?: boolean };
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const refreshToken = await SecureStore.getItemAsync('refreshToken');
        const { data } = await axios.post(`${BASE_URL}/auth/refresh-token`, { refreshToken });
        await SecureStore.setItemAsync('accessToken', data.data.accessToken);
        api.defaults.headers.common.Authorization = `Bearer ${data.data.accessToken}`;
        return api(original);
      } catch {
        await SecureStore.deleteItemAsync('accessToken');
        await SecureStore.deleteItemAsync('refreshToken');
      }
    }
    return Promise.reject(error);
  }
);

// Auth
export const authApi = {
  register: (body: { username: string; email: string; password: string; referralCode?: string }) =>
    api.post('/auth/register', body),
  login: (body: { email: string; password: string }) => api.post('/auth/login', body),
  logout: () => api.post('/auth/logout'),
  refreshToken: (refreshToken: string) => api.post('/auth/refresh-token', { refreshToken }),
};

// Users
export const usersApi = {
  getMe: () => api.get('/users/me'),
  updateProfile: (body: Partial<{ username: string; name: string; phoneNumber: string; dateOfBirth: string }>) =>
    api.patch('/users/me/profile', body),
  updateLanguage: (lang: 'id' | 'en') => api.patch('/users/me/language', { lang }),
  updateHideBalance: (hide: boolean) => api.patch('/users/me/hide-balance', { hide }),
  deleteAccount: () => api.delete('/users/me'),
};

// Properties
export const propertiesApi = {
  list: (params?: { search?: string; status?: string; page?: number; limit?: number }) =>
    api.get('/properties', { params }),
  getFeatured: () => api.get('/properties/featured'),
  getRunningOutSoon: () => api.get('/properties/running-out-soon'),
  getById: (id: string) => api.get(`/properties/${id}`),
  getTopHolders: (id: string) => api.get(`/properties/${id}/top-holders`),
  getYieldHistory: (id: string) => api.get(`/properties/${id}/yield-history`),
  getTimeline: (id: string) => api.get(`/properties/${id}/timeline`),
  getBlockchain: (id: string) => api.get(`/properties/${id}/blockchain`),
};

// Investments
export const investmentsApi = {
  buy: (body: { propertyId: string; tokenAmount: number }) => api.post('/investments/buy', body),
  sell: (body: { propertyId: string; tokenAmount: number }) => api.post('/investments/sell', body),
  swap: (body: { fromPropertyId: string; toPropertyId: string; tokenAmount: number }) =>
    api.post('/investments/swap', body),
  getPortfolio: () => api.get('/investments/portfolio'),
};

// Yields
export const yieldsApi = {
  list: (params?: { propertyId?: string; month?: number; year?: number }) =>
    api.get('/yields', { params }),
  getSummary: () => api.get('/yields/summary'),
};

// Bank accounts
export const bankAccountsApi = {
  list: () => api.get('/bank-accounts'),
  create: (body: { bankName: string; accountNumber: string; accountHolder: string }) =>
    api.post('/bank-accounts', body),
  delete: (id: string) => api.delete(`/bank-accounts/${id}`),
};

// Withdrawals
export const withdrawalsApi = {
  list: () => api.get('/withdrawals'),
  create: (body: { bankAccountId: string; amountIdr: number }) => api.post('/withdrawals', body),
  getHistory: () => api.get('/withdrawals/history'),
};

// Referrals
export const referralsApi = {
  getMyStats: () => api.get('/referrals/my-stats'),
  getLeaderboard: (period: 'weekly' | 'monthly' | 'all-time') =>
    api.get('/referrals/leaderboard', { params: { period } }),
};

// Transactions
export const transactionsApi = {
  list: (params?: { type?: string; page?: number; limit?: number }) =>
    api.get('/transactions', { params }),
};

// Events
export const eventsApi = {
  list: () => api.get('/events'),
};

export default api;
