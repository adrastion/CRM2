import axios, { AxiosInstance, AxiosResponse } from 'axios';
import {
  ApiResponse,
  AuthResponse,
  LoginForm,
  RegisterForm,
  MarketerStatsSummary,
  UnifiedStaffLoginResponse,
  IdentifyResponse,
  UnifiedLoginResponse,
  UnifiedSession,
  AccountType,
  ClientDashboardData,
  PublicAccount,
  SubscriptionPlanItem,
  PublicPlanItem,
  SubscriptionGrantLogItem,
  LogFileInfoResponse,
  LogFileContentResponse,
} from '../types';
import { apiCache, generateCacheKey } from '../utils/apiCache';
import {
  fallbackToSchoolAccount,
  getActiveAccountId,
  removeSavedAccount,
} from '../utils/accountSwitcher';

export type NotificationPrefs = {
  actorType: string;
  actorId: string;
  chatMessagesEnabled: boolean;
  changelogEnabled: boolean;
  pushMasterEnabled: boolean;
  scheduleMode: 'ALWAYS' | 'WINDOW';
  windowStartMinutes: number | null;
  windowEndMinutes: number | null;
  daysOfWeek: string | null;
  timezone: string;
};

/** Разбор Content-Disposition: предпочитаем filename*=UTF-8''… (кириллица). */
function parseContentDispositionFilename(
  disposition: string | undefined,
  fallback: string
): string {
  const header = String(disposition || '');
  const utf8Match = header.match(/filename\*\s*=\s*UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1].trim());
    } catch {
      return utf8Match[1].trim();
    }
  }
  const plainMatch = header.match(/filename\s*=\s*"?([^";]+)"?/i);
  if (plainMatch?.[1]) return plainMatch[1].trim();
  return fallback;
}

class ApiService {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: process.env.REACT_APP_API_URL || '/api',
      timeout: 10000,
      withCredentials: true,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor to add auth token
    this.api.interceptors.request.use(
      (config) => {
        // Check for super admin token first (for admin dashboard routes)
        const superAdminToken = localStorage.getItem('superAdminToken');
        const testerToken = localStorage.getItem('testerToken');
        const platformStaffToken = localStorage.getItem('platformStaffToken');
        const promoCodeAdminToken = localStorage.getItem('promoCodeAdminToken');
        const marketerToken = localStorage.getItem('marketerToken');
        const clientToken = localStorage.getItem('clientToken');
        const regularToken = localStorage.getItem('token');
        
        if (superAdminToken) {
          config.headers.Authorization = `Bearer ${superAdminToken}`;
        } else if (testerToken) {
          config.headers.Authorization = `Bearer ${testerToken}`;
        } else if (platformStaffToken && (config.url?.includes('/platform-staff/') || config.url?.includes('/platform-staff/auth/'))) {
          config.headers.Authorization = `Bearer ${platformStaffToken}`;
        } else if (promoCodeAdminToken) {
          config.headers.Authorization = `Bearer ${promoCodeAdminToken}`;
        } else if (marketerToken) {
          config.headers.Authorization = `Bearer ${marketerToken}`;
        } else if (clientToken) {
          config.headers.Authorization = `Bearer ${clientToken}`;
        } else if (regularToken) {
          config.headers.Authorization = `Bearer ${regularToken}`;
        }

        // CSRF double-submit при cookie-сессии без Bearer
        if (!config.headers.Authorization && typeof document !== 'undefined') {
          const match = document.cookie.match(/(?:^|;\s*)crm_csrf=([^;]+)/);
          if (match?.[1]) {
            config.headers['X-CSRF-Token'] = decodeURIComponent(match[1]);
          }
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor to handle errors
    this.api.interceptors.response.use(
      (response: AxiosResponse) => {
        return response;
      },
      (error) => {
        // Ignore cancelled requests (they are not real errors)
        if (axios.isCancel(error) || error?.code === 'ERR_CANCELED' || error?.message === 'canceled') {
          return Promise.reject(error);
        }
        
        if (error.response?.status === 503 && error.response?.data?.code === 'MAINTENANCE') {
          if (!localStorage.getItem('superAdminToken')) {
            sessionStorage.setItem('maintenanceMode', '1');
            window.dispatchEvent(
              new CustomEvent('maintenance-mode', {
                detail: {
                  enabled: true,
                  message: error.response?.data?.error || '',
                },
              })
            );
            const path = window.location.pathname;
            if (path !== '/auth' && path !== '/maintenance') {
              window.location.href = '/maintenance';
            }
          }
          return Promise.reject(error);
        }

        if (error.response?.status === 401) {
          // Token expired or invalid
          const url = error.config?.url || '';
          
          // Don't redirect on login endpoints - let them handle the error
          const isLoginEndpoint = url.includes('/auth/login') || 
                                 url.includes('/auth/unified-staff-login') ||
                                 url.includes('/auth/identify') ||
                                 url.includes('/auth/unified-login') ||
                                 url.includes('/auth/setup-password') ||
                                 url.includes('/auth/select-account') ||
                                 url.includes('/auth/marketer/login') ||
                                 url.includes('/auth/promo-code-admin/login') ||
                                 url.includes('/auth/super-admin/login') ||
                                 url.includes('/platform-staff/auth/login') ||
                                 url.includes('/client-auth/login') ||
                                 url.includes('/client-auth/register');
          
          // Если это endpoint авторизации - не перенаправляем, просто пробрасываем ошибку
          if (isLoginEndpoint) {
            return Promise.reject(error);
          }
          
          // Check if it's a super admin route
          const isSuperAdminRoute = url.includes('/super-admin/') || 
                                    url.includes('/admin-dashboard') ||
                                    localStorage.getItem('superAdminToken');

          const isPlatformRoute =
            url.includes('/platform/') || localStorage.getItem('testerToken');
          
          // Check if it's a marketer route (marketers/me/stats, or any /marketers route with marketer token)
          const isMarketerRoute = url.includes('/marketers/me/') || 
                                  (url.includes('/marketers/') && localStorage.getItem('marketerToken'));
          
          // Check if it's a promo code admin route
          const isPromoCodeAdminRoute = url.includes('/promo-codes') || 
                                        url.includes('/referral-links') ||
                                        (url.includes('/marketers/') && !localStorage.getItem('marketerToken') && localStorage.getItem('promoCodeAdminToken'));
          
          if (isSuperAdminRoute && localStorage.getItem('superAdminToken')) {
            const activeId = getActiveAccountId();
            if (activeId?.startsWith('SUPER_ADMIN:')) removeSavedAccount(activeId);
            localStorage.removeItem('superAdminToken');
            localStorage.removeItem('superAdmin');
            const schoolDest = fallbackToSchoolAccount();
            window.location.href = schoolDest || '/';
          } else if (isPlatformRoute && localStorage.getItem('testerToken') && !localStorage.getItem('superAdminToken')) {
            const activeId = getActiveAccountId();
            if (activeId?.startsWith('TESTER:')) removeSavedAccount(activeId);
            localStorage.removeItem('testerToken');
            localStorage.removeItem('tester');
            const schoolDest = fallbackToSchoolAccount();
            window.location.href = schoolDest || '/';
          } else if (isMarketerRoute) {
            localStorage.removeItem('marketerToken');
            localStorage.removeItem('marketer');
            localStorage.removeItem('marketerTenant');
            window.location.href = '/';
          } else if (isPromoCodeAdminRoute) {
            localStorage.removeItem('promoCodeAdminToken');
            localStorage.removeItem('promoCodeAdmin');
            localStorage.removeItem('promoCodeAdminTenant');
            window.location.href = '/';
          } else if (url.includes('/platform-staff/')) {
            localStorage.removeItem('platformStaffToken');
            localStorage.removeItem('platformStaff');
            window.location.href = '/';
          } else if (url.includes('/client-auth/')) {
            localStorage.removeItem('clientToken');
            localStorage.removeItem('client');
            localStorage.removeItem('clientTenant');
            localStorage.removeItem('userType');
            window.location.href = '/';
          } else {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            localStorage.removeItem('tenant');
            window.location.href = '/';
          }
        }
        return Promise.reject(error);
      }
    );
  }

  // Auth endpoints
  /* ---------------- Единая авторизация ---------------- */

  /** Шаг 1: проверяем телефон/email и узнаём, нужен ли экран создания пароля. */
  async identify(identifier: string): Promise<IdentifyResponse> {
    const response = await this.api.post<ApiResponse<IdentifyResponse>>('/auth/identify', {
      identifier,
    });
    return response.data.data!;
  }

  /** Шаг 2а: первый вход — создание пароля. */
  async setupPassword(payload: {
    identifier: string;
    password: string;
    confirmPassword: string;
    acceptTerms: boolean;
    rememberMe?: boolean;
  }): Promise<UnifiedLoginResponse> {
    const response = await this.api.post<ApiResponse<UnifiedLoginResponse>>(
      '/auth/setup-password',
      payload
    );
    return response.data.data!;
  }

  /** Шаг 2б: вход по существующему паролю. */
  async unifiedLogin(payload: {
    identifier: string;
    password: string;
    rememberMe?: boolean;
  }): Promise<UnifiedLoginResponse> {
    const response = await this.api.post<ApiResponse<UnifiedLoginResponse>>(
      '/auth/unified-login',
      payload
    );
    return response.data.data!;
  }

  /** Шаг 3: выбор организации/роли, когда найдено несколько аккаунтов. */
  async selectAccount(payload: {
    selectionToken: string;
    accountType: AccountType;
    accountId: string;
  }): Promise<UnifiedSession> {
    const response = await this.api.post<ApiResponse<UnifiedSession>>(
      '/auth/select-account',
      payload
    );
    return response.data.data!;
  }

  async login(credentials: LoginForm): Promise<AuthResponse> {
    const response = await this.api.post<ApiResponse<AuthResponse>>('/auth/login', credentials);
    return response.data.data!;
  }

  async unifiedStaffLogin(credentials: LoginForm): Promise<UnifiedStaffLoginResponse> {
    const response = await this.api.post<ApiResponse<UnifiedStaffLoginResponse>>(
      '/auth/unified-staff-login',
      credentials
    );
    return response.data.data!;
  }

  async marketerLogin(credentials: LoginForm): Promise<any> {
    const response = await this.api.post<ApiResponse>('/auth/marketer/login', credentials);
    return response.data.data!;
  }

  async promoCodeAdminLogin(credentials: LoginForm): Promise<any> {
    const response = await this.api.post<ApiResponse>('/auth/promo-code-admin/login', credentials);
    return response.data.data!;
  }

  async register(data: RegisterForm): Promise<AuthResponse> {
    const response = await this.api.post<ApiResponse<AuthResponse>>('/auth/register', data);
    return response.data.data!;
  }

  async logout(): Promise<void> {
    await this.api.post('/auth/logout');
  }

  async getProfile(): Promise<any> {
    const response = await this.api.get<ApiResponse>('/auth/profile');
    return response.data.data;
  }

  /** Актуальные SA/Tester сессии, привязанные к текущему школьному пользователю. */
  async getLinkedSessions(): Promise<{ linkedSessions: any[] }> {
    const response = await this.api.get<ApiResponse>('/auth/linked-sessions');
    return response.data.data || { linkedSessions: [] };
  }

  async updateProfile(data: any): Promise<any> {
    const response = await this.api.put<ApiResponse>('/auth/profile', data);
    return response.data.data;
  }

  async createUser(data: any): Promise<any> {
    const response = await this.api.post<ApiResponse>('/auth/users', data);
    return response.data.data;
  }

  async updateUser(id: string, data: any): Promise<any> {
    const response = await this.api.put<ApiResponse>(`/auth/users/${id}`, data);
    return response.data.data;
  }

  async deleteUser(id: string): Promise<void> {
    await this.api.delete(`/auth/users/${id}`);
  }

  async changePassword(data: { currentPassword: string; newPassword: string }): Promise<void> {
    await this.api.post('/auth/change-password', data);
  }

  async changeEmail(data: { newEmail: string; password: string }): Promise<void> {
    await this.api.post('/auth/change-email', data);
  }

  async requestPasswordReset(email: string): Promise<{ message?: string }> {
    const response = await this.api.post<ApiResponse>('/auth/password-reset/request', { email });
    return response.data.data || { message: response.data.message };
  }

  async verifyPasswordResetCode(email: string, code: string): Promise<{
    resetToken: string;
    accounts: PublicAccount[];
  }> {
    const response = await this.api.post<ApiResponse>('/auth/password-reset/verify-code', { email, code });
    return response.data.data;
  }

  async confirmPasswordReset(data: {
    resetToken: string;
    newPassword: string;
    accountType: string;
    accountId: string;
  }): Promise<void> {
    await this.api.post('/auth/password-reset/confirm', data);
  }

  async sendEmailVerification(): Promise<{ message?: string; email?: string; alreadyVerified?: boolean }> {
    const response = await this.api.post<ApiResponse>('/auth/email/send-verification');
    return response.data.data || {};
  }

  async verifyEmailCode(code: string): Promise<{ emailVerified?: boolean; message?: string }> {
    const response = await this.api.post<ApiResponse>('/auth/email/verify', { code });
    return response.data.data || {};
  }

  /** @deprecated */
  async resetPassword(_data: { token: string; newPassword: string }): Promise<void> {
    await this.api.post('/auth/reset-password', _data);
  }

  // Client endpoints
  async getClients(params?: any, signal?: AbortSignal, useCache: boolean = true): Promise<{ data: any[]; pagination: any }> {
    const cacheKey = generateCacheKey('/clients', params);
    
    if (useCache && !signal) {
      const cached = apiCache.get<{ data: any[]; pagination: any }>(cacheKey);
      if (cached) {
        return cached;
      }
    }
    
    const response = await this.api.get<ApiResponse>('/clients', { params, signal });
    const result = {
      data: response.data.data || [],
      pagination: response.data.pagination
    };
    
    if (useCache && !signal) {
      apiCache.set(cacheKey, result, 2 * 60 * 1000); // Кэш на 2 минуты
    }
    
    return result;
  }

  async getClient(id: string): Promise<any> {
    const response = await this.api.get<ApiResponse>(`/clients/${id}`);
    return response.data.data;
  }

  async createClient(data: any): Promise<any> {
    const response = await this.api.post<ApiResponse>('/clients', data);
    return response.data.data;
  }

  async assignClientTrial(clientId: string, trainingId: string): Promise<any> {
    const response = await this.api.post<ApiResponse>(`/clients/${clientId}/trial`, { trainingId });
    return response.data.data;
  }

  async updateClient(id: string, data: any): Promise<any> {
    const response = await this.api.put<ApiResponse>(`/clients/${id}`, data);
    return response.data.data;
  }

  async updateClientMembershipFeeStatus(id: string, membershipFeePaid: boolean): Promise<any> {
    const response = await this.api.put<ApiResponse>(`/clients/${id}/membership-fee`, { membershipFeePaid });
    return response.data.data;
  }

  async deleteClient(id: string): Promise<void> {
    await this.api.delete(`/clients/${id}`);
  }

  async exportClients(): Promise<Blob> {
    const response = await this.api.get('/clients/export/excel', {
      responseType: 'blob'
    });
    return response.data;
  }

  async downloadClientTemplate(): Promise<Blob> {
    const response = await this.api.get('/clients/export/template', {
      responseType: 'blob'
    });
    return response.data;
  }

  async importClients(file: File): Promise<any> {
    const formData = new FormData();
    formData.append('file', file);
    const response = await this.api.post<ApiResponse>('/clients/import/excel', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    return response.data;
  }

  async addAchievement(clientId: string, data: any): Promise<any> {
    const response = await this.api.post<ApiResponse>(`/clients/${clientId}/achievements`, data);
    return response.data.data;
  }

  async removeAchievement(clientId: string, achievementId: string): Promise<void> {
    await this.api.delete(`/clients/${clientId}/achievements/${achievementId}`);
  }

  async getClientStats(id: string): Promise<any> {
    const response = await this.api.get<ApiResponse>(`/clients/${id}/stats`);
    return response.data.data;
  }

  // Trainer endpoints
  async getTrainers(params?: any, signal?: AbortSignal, useCache: boolean = true): Promise<{ data: any[]; pagination: any }> {
    const cacheKey = generateCacheKey('/trainers', params);
    
    if (useCache && !signal) {
      const cached = apiCache.get<{ data: any[]; pagination: any }>(cacheKey);
      if (cached) {
        return cached;
      }
    }
    
    const response = await this.api.get<ApiResponse>('/trainers', { params, signal });
    const result = {
      data: response.data.data || [],
      pagination: response.data.pagination
    };
    
    if (useCache && !signal) {
      apiCache.set(cacheKey, result, 5 * 60 * 1000); // Кэш на 5 минут
    }
    
    return result;
  }

  async getTrainer(id: string): Promise<any> {
    const response = await this.api.get<ApiResponse>(`/trainers/${id}`);
    return response.data.data;
  }

  async createTrainer(data: any): Promise<any> {
    const response = await this.api.post<ApiResponse>('/trainers', data);
    return response.data.data;
  }

  async updateTrainer(id: string, data: any): Promise<any> {
    const response = await this.api.put<ApiResponse>(`/trainers/${id}`, data);
    return response.data.data;
  }

  async deleteTrainer(id: string): Promise<void> {
    await this.api.delete(`/trainers/${id}`);
  }

  async addBranchToTrainer(trainerId: string, branchId: string): Promise<any> {
    const response = await this.api.post<ApiResponse>(`/trainers/${trainerId}/branches`, { branchId });
    return response.data.data;
  }

  async removeBranchFromTrainer(trainerId: string, branchId: string): Promise<void> {
    await this.api.delete(`/trainers/${trainerId}/branches/${branchId}`);
  }

  async getTrainerEarnings(trainerId: string, params?: any): Promise<any> {
    const response = await this.api.get<ApiResponse>(`/trainers/${trainerId}/earnings`, { params });
    return response.data.data;
  }

  async getAllTrainersEarnings(params?: any): Promise<any> {
    const response = await this.api.get<ApiResponse>('/trainers/earnings/all', { params });
    return response.data.data;
  }

  async getTrainerSalaryLedger(trainerId: string, params?: any): Promise<any> {
    const response = await this.api.get<ApiResponse>(`/trainers/${trainerId}/salary-ledger`, { params });
    return response.data.data;
  }

  async postTrainerSalaryLedger(trainerId: string, data: any): Promise<any> {
    const response = await this.api.post<ApiResponse>(`/trainers/${trainerId}/salary-ledger`, data);
    return response.data.data;
  }

  async getSalaryPayoutReminder(): Promise<any> {
    const response = await this.api.get<ApiResponse>('/trainers/salary-payout-reminder');
    return response.data.data;
  }

  async accrueFixedMonthlySalaries(): Promise<any> {
    const response = await this.api.post<ApiResponse>('/trainers/accrue-fixed-monthly');
    return response.data.data;
  }

  async getTrainerNotificationSettings(trainerId: string): Promise<any> {
    const response = await this.api.get<ApiResponse>(`/trainers/${trainerId}/notifications`);
    return response.data.data;
  }

  async updateTrainerNotificationSettings(trainerId: string, data: any): Promise<any> {
    const response = await this.api.put<ApiResponse>(`/trainers/${trainerId}/notifications`, data);
    return response.data.data;
  }

  // Push notification endpoints
  async getVapidKey(): Promise<string> {
    const response = await this.api.get<ApiResponse>('/push-notifications/vapid-key');
    return response.data.data.publicKey;
  }

  async subscribeToPush(subscription: any, userAgent?: string): Promise<any> {
    const response = await this.api.post<ApiResponse>('/push-notifications/subscribe', {
      subscription,
      userAgent
    });
    return response.data;
  }

  async unsubscribeFromPush(endpoint: string): Promise<any> {
    const response = await this.api.post<ApiResponse>('/push-notifications/unsubscribe', {
      endpoint
    });
    return response.data;
  }

  async getUserPushSubscriptions(): Promise<any[]> {
    const response = await this.api.get<ApiResponse>('/push-notifications/subscriptions');
    return response.data.data;
  }

  // Notification preferences (chat / changelog / schedule)
  async getSchoolNotificationPrefs(): Promise<NotificationPrefs> {
    const response = await this.api.get<ApiResponse>('/notification-prefs');
    return response.data.data;
  }

  async updateSchoolNotificationPrefs(data: Partial<NotificationPrefs>): Promise<NotificationPrefs> {
    const response = await this.api.put<ApiResponse>('/notification-prefs', data);
    return response.data.data;
  }

  async getPortalNotificationPrefs(): Promise<NotificationPrefs> {
    const response = await this.api.get<ApiResponse>('/client-auth/notification-prefs');
    return response.data.data;
  }

  async updatePortalNotificationPrefs(data: Partial<NotificationPrefs>): Promise<NotificationPrefs> {
    const response = await this.api.put<ApiResponse>('/client-auth/notification-prefs', data);
    return response.data.data;
  }

  async getPortalPushVapidKey(): Promise<string | null> {
    const response = await this.api.get<ApiResponse>('/client-auth/push/vapid-key');
    return response.data.data?.publicKey || null;
  }

  async subscribePortalPush(subscription: any, userAgent?: string): Promise<any> {
    const response = await this.api.post<ApiResponse>('/client-auth/push/subscribe', {
      subscription,
      userAgent,
    });
    return response.data;
  }

  async unsubscribePortalPush(endpoint: string): Promise<any> {
    const response = await this.api.post<ApiResponse>('/client-auth/push/unsubscribe', {
      endpoint,
    });
    return response.data;
  }

  async getPortalPushStatus(): Promise<{ subscribed: boolean; count: number }> {
    const response = await this.api.get<ApiResponse>('/client-auth/push/status');
    return response.data.data;
  }

  async getSuperAdminNotificationPrefs(): Promise<NotificationPrefs> {
    const response = await this.api.get<ApiResponse>('/admin-dashboard/notification-prefs');
    return response.data.data;
  }

  async updateSuperAdminNotificationPrefs(data: Partial<NotificationPrefs>): Promise<NotificationPrefs> {
    const response = await this.api.put<ApiResponse>('/admin-dashboard/notification-prefs', data);
    return response.data.data;
  }

  async getTesterNotificationPrefs(): Promise<NotificationPrefs> {
    const response = await this.api.get<ApiResponse>('/platform/tester/notification-prefs');
    return response.data.data;
  }

  async updateTesterNotificationPrefs(data: Partial<NotificationPrefs>): Promise<NotificationPrefs> {
    const response = await this.api.put<ApiResponse>('/platform/tester/notification-prefs', data);
    return response.data.data;
  }

  async getTesterPushVapidKey(): Promise<string | null> {
    const response = await this.api.get<ApiResponse>('/platform/tester/push/vapid-key');
    return response.data.data?.publicKey || null;
  }

  async subscribeTesterPush(subscription: any, userAgent?: string): Promise<any> {
    const response = await this.api.post<ApiResponse>('/platform/tester/push/subscribe', {
      subscription,
      userAgent,
    });
    return response.data;
  }

  async unsubscribeTesterPush(endpoint: string): Promise<any> {
    const response = await this.api.post<ApiResponse>('/platform/tester/push/unsubscribe', {
      endpoint,
    });
    return response.data;
  }

  async getTesterPushStatus(): Promise<{ subscribed: boolean; count: number }> {
    const response = await this.api.get<ApiResponse>('/platform/tester/push/status');
    return response.data.data;
  }

  async getMaintenanceStatus(): Promise<{ enabled: boolean; message: string }> {
    const response = await this.api.get<ApiResponse>('/maintenance/status');
    return response.data.data;
  }

  async getAdminMaintenance(): Promise<{ enabled: boolean; message: string }> {
    const response = await this.api.get<ApiResponse>('/admin-dashboard/maintenance');
    return response.data.data;
  }

  async updateAdminMaintenance(enabled: boolean): Promise<{ enabled: boolean; message: string }> {
    const response = await this.api.put<ApiResponse>('/admin-dashboard/maintenance', { enabled });
    return response.data.data;
  }

  // Standard endpoints (Нормативы)
  async getStandards(params?: any): Promise<{ data: any[] }> {
    const response = await this.api.get<ApiResponse>('/standards', { params });
    return {
      data: response.data.data || []
    };
  }

  async getStandard(id: string): Promise<any> {
    const response = await this.api.get<ApiResponse>(`/standards/${id}`);
    return response.data.data;
  }

  async createStandard(data: any): Promise<any> {
    const response = await this.api.post<ApiResponse>('/standards', data);
    return response.data.data;
  }

  async updateStandard(id: string, data: any): Promise<any> {
    const response = await this.api.put<ApiResponse>(`/standards/${id}`, data);
    return response.data.data;
  }

  async deleteStandard(id: string): Promise<void> {
    await this.api.delete(`/standards/${id}`);
  }

  // Client Standards endpoints (Выполнения нормативов клиентом)
  async getClientStandards(clientId: string): Promise<{ data: any[] }> {
    const response = await this.api.get<ApiResponse>(`/standards/clients/${clientId}`);
    return {
      data: response.data.data || []
    };
  }

  async addClientStandard(clientId: string, data: any): Promise<any> {
    const response = await this.api.post<ApiResponse>(`/standards/clients/${clientId}`, data);
    return response.data.data;
  }

  async updateClientStandard(clientId: string, clientStandardId: string, data: any): Promise<any> {
    const response = await this.api.put<ApiResponse>(`/standards/clients/${clientId}/${clientStandardId}`, data);
    return response.data.data;
  }

  async deleteClientStandard(clientId: string, clientStandardId: string): Promise<void> {
    await this.api.delete(`/standards/clients/${clientId}/${clientStandardId}`);
  }

  // Group endpoints
  async getGroups(params?: any, signal?: AbortSignal, useCache: boolean = true): Promise<{ data: any[]; pagination: any }> {
    const cacheKey = generateCacheKey('/groups', params);
    
    if (useCache && !signal) {
      const cached = apiCache.get<{ data: any[]; pagination: any }>(cacheKey);
      if (cached) {
        return cached;
      }
    }
    
    const response = await this.api.get<ApiResponse>('/groups', { params, signal });
    const result = {
      data: response.data.data || [],
      pagination: response.data.pagination
    };
    
    if (useCache && !signal) {
      apiCache.set(cacheKey, result, 5 * 60 * 1000); // Кэш на 5 минут
    }
    
    return result;
  }

  async getGroup(id: string): Promise<any> {
    const response = await this.api.get<ApiResponse>(`/groups/${id}`);
    return response.data.data;
  }

  async createGroup(data: any): Promise<any> {
    const response = await this.api.post<ApiResponse>('/groups', data);
    return response.data.data;
  }

  async updateGroup(id: string, data: any): Promise<any> {
    const response = await this.api.put<ApiResponse>(`/groups/${id}`, data);
    return response.data.data;
  }

  async deleteGroup(id: string): Promise<void> {
    await this.api.delete(`/groups/${id}`);
  }

  async addClientToGroup(groupId: string, clientId: string): Promise<any> {
    const response = await this.api.post<ApiResponse>(`/groups/${groupId}/clients`, { clientId });
    return response.data.data;
  }

  async removeClientFromGroup(groupId: string, clientId: string): Promise<void> {
    await this.api.delete(`/groups/${groupId}/clients/${clientId}`);
  }

  // Branch endpoints
  async getBranches(params?: any, signal?: AbortSignal, useCache: boolean = true): Promise<{ data: any[]; pagination: any }> {
    const cacheKey = generateCacheKey('/branches', params);
    
    if (useCache && !signal) {
      const cached = apiCache.get<{ data: any[]; pagination: any }>(cacheKey);
      if (cached) {
        return cached;
      }
    }
    
    const response = await this.api.get<ApiResponse>('/branches', { params, signal });
    const result = {
      data: response.data.data || [],
      pagination: response.data.pagination
    };
    
    if (useCache && !signal) {
      apiCache.set(cacheKey, result, 10 * 60 * 1000); // Кэш на 10 минут (филиалы редко меняются)
    }
    
    return result;
  }

  async getBranch(id: string): Promise<any> {
    const response = await this.api.get<ApiResponse>(`/branches/${id}`);
    return response.data.data;
  }

  async createBranch(data: any): Promise<any> {
    const response = await this.api.post<ApiResponse>('/branches', data);
    return response.data.data;
  }

  async updateBranch(id: string, data: any): Promise<any> {
    const response = await this.api.put<ApiResponse>(`/branches/${id}`, data);
    return response.data.data;
  }

  async deleteBranch(id: string): Promise<void> {
    await this.api.delete(`/branches/${id}`);
  }

  // Hall endpoints
  async getHalls(params?: any, signal?: AbortSignal, useCache: boolean = true): Promise<{ data: any[]; pagination: any }> {
    const cacheKey = generateCacheKey('/halls', params);
    
    if (useCache && !signal) {
      const cached = apiCache.get<{ data: any[]; pagination: any }>(cacheKey);
      if (cached) {
        return cached;
      }
    }
    
    const response = await this.api.get<ApiResponse>('/halls', { params, signal });
    const result = {
      data: response.data.data || [],
      pagination: response.data.pagination
    };
    
    if (useCache && !signal) {
      apiCache.set(cacheKey, result, 10 * 60 * 1000); // Кэш на 10 минут
    }
    
    return result;
  }

  async getHall(id: string): Promise<any> {
    const response = await this.api.get<ApiResponse>(`/halls/${id}`);
    return response.data.data;
  }

  async createHall(data: any): Promise<any> {
    const response = await this.api.post<ApiResponse>('/halls', data);
    return response.data.data;
  }

  async updateHall(id: string, data: any): Promise<any> {
    const response = await this.api.put<ApiResponse>(`/halls/${id}`, data);
    return response.data.data;
  }

  async deleteHall(id: string): Promise<void> {
    await this.api.delete(`/halls/${id}`);
  }

  // Training endpoints
  async getTrainings(params?: any, signal?: AbortSignal): Promise<{ data: any[]; pagination: any }> {
    const response = await this.api.get<ApiResponse>('/trainings', { params, signal });
    return {
      data: response.data.data || [],
      pagination: response.data.pagination
    };
  }

  async getTraining(id: string): Promise<any> {
    const response = await this.api.get<ApiResponse>(`/trainings/${id}`);
    return response.data.data;
  }

  async createTraining(data: any): Promise<any> {
    const response = await this.api.post<ApiResponse>('/trainings', data);
    return response.data.data;
  }

  async createTrainingsBatch(trainings: any[]): Promise<{ created: any[]; failed: any[]; createdCount: number; failedCount: number }> {
    const response = await this.api.post<ApiResponse>('/trainings/batch', { trainings });
    return response.data.data;
  }

  async updateTraining(id: string, data: any): Promise<any> {
    const response = await this.api.put<ApiResponse>(`/trainings/${id}`, data);
    return response.data.data;
  }

  async deleteTraining(id: string): Promise<void> {
    await this.api.delete(`/trainings/${id}`);
  }

  async deleteTrainingsBatch(trainingIds: string[]): Promise<{ deletedCount: number }> {
    const response = await this.api.delete<ApiResponse>('/trainings/batch', { data: { trainingIds } });
    return response.data.data;
  }

  async removeDuplicateTrainings(): Promise<{ removedCount: number; removedIds: string[] }> {
    const response = await this.api.post<ApiResponse>('/trainings/remove-duplicates');
    return response.data.data;
  }

  // Competition endpoints
  async getCompetitions(params?: any, signal?: AbortSignal): Promise<{ data: any[]; pagination: any }> {
    const response = await this.api.get<ApiResponse>('/competitions', { params, signal });
    return {
      data: response.data.data || [],
      pagination: response.data.pagination
    };
  }

  async getCompetition(id: string): Promise<any> {
    const response = await this.api.get<ApiResponse>(`/competitions/${id}`);
    return response.data.data;
  }

  async createCompetition(data: any): Promise<any> {
    const response = await this.api.post<ApiResponse>('/competitions', data);
    return response.data.data;
  }

  async updateCompetition(id: string, data: any): Promise<any> {
    const response = await this.api.put<ApiResponse>(`/competitions/${id}`, data);
    return response.data.data;
  }

  async deleteCompetition(id: string): Promise<void> {
    await this.api.delete(`/competitions/${id}`);
  }

  async getSchoolEvents(params?: { startDate?: string; endDate?: string; type?: string }, signal?: AbortSignal): Promise<any[]> {
    const response = await this.api.get<ApiResponse>('/school-events', { params, signal });
    return response.data.data || [];
  }

  async getSchoolEvent(id: string): Promise<any> {
    const response = await this.api.get<ApiResponse>(`/school-events/${id}`);
    return response.data.data;
  }

  async createSchoolEvent(data: any): Promise<any> {
    const response = await this.api.post<ApiResponse>('/school-events', data);
    return response.data.data;
  }

  async updateSchoolEvent(id: string, data: any): Promise<any> {
    const response = await this.api.put<ApiResponse>(`/school-events/${id}`, data);
    return response.data.data;
  }

  async deleteSchoolEvent(id: string): Promise<void> {
    await this.api.delete(`/school-events/${id}`);
  }

  async addCompetitionResult(competitionId: string, data: any): Promise<any> {
    const response = await this.api.post<ApiResponse>(`/competitions/${competitionId}/results`, data);
    return response.data.data;
  }

  async updateCompetitionResult(id: string, data: any): Promise<any> {
    const response = await this.api.put<ApiResponse>(`/competitions/results/${id}`, data);
    return response.data.data;
  }

  async deleteCompetitionResult(id: string): Promise<void> {
    await this.api.delete(`/competitions/results/${id}`);
  }

  async updateCompetitionAttendance(competitionId: string, participantId: string, data: any): Promise<any> {
    const response = await this.api.put<ApiResponse>(`/competitions/${competitionId}/attendance/${participantId}`, data);
    return response.data.data;
  }

  async getTrainerConflicts(competitionId: string, params?: any): Promise<any[]> {
    const response = await this.api.get<ApiResponse>(`/competitions/${competitionId}/trainer-conflicts`, { params });
    return response.data.data || [];
  }

  // Attendance endpoints
  async getAttendances(params?: any): Promise<{ data: any[]; pagination: any }> {
    const response = await this.api.get<ApiResponse>('/attendances', { params });
    return {
      data: response.data.data || [],
      pagination: response.data.pagination
    };
  }

  async exportAttendanceExcel(params: {
    scope: 'trainer' | 'client' | 'group';
    id: string;
    from?: string;
    to?: string;
  }): Promise<{ blob: Blob; filename: string }> {
    const response = await this.api.get('/attendances/export/excel', {
      params,
      responseType: 'blob',
    });
    const disposition = String(response.headers['content-disposition'] || '');
    let filename = `attendance_${params.scope}_${params.from || ''}_${params.to || ''}.xlsx`;
    const utf8Match = disposition.match(/filename\*\s*=\s*UTF-8''([^;]+)/i);
    const plainMatch = disposition.match(/filename\s*=\s*"?([^";]+)"?/i);
    if (utf8Match?.[1]) {
      try {
        filename = decodeURIComponent(utf8Match[1].trim());
      } catch {
        filename = utf8Match[1].trim();
      }
    } else if (plainMatch?.[1]) {
      filename = plainMatch[1].trim();
    }
    return { blob: response.data, filename };
  }

  async getAttendance(id: string): Promise<any> {
    const response = await this.api.get<ApiResponse>(`/attendances/${id}`);
    return response.data.data;
  }

  async createAttendance(data: any): Promise<any> {
    const response = await this.api.post<ApiResponse>('/attendances', data);
    return response.data.data;
  }

  async updateAttendance(id: string, data: any): Promise<any> {
    const response = await this.api.put<ApiResponse>(`/attendances/${id}`, data);
    return response.data.data;
  }

  async deleteAttendance(id: string): Promise<void> {
    await this.api.delete(`/attendances/${id}`);
  }

  async getAttendancesByTraining(trainingId: string): Promise<any> {
    const response = await this.api.get<ApiResponse>(`/attendances/training/${trainingId}`);
    return response.data.data;
  }

  async bulkUpdateAttendance(trainingId: string, attendances: any[]): Promise<any> {
    const response = await this.api.post<ApiResponse>('/attendances/bulk', {
      trainingId,
      attendances
    });
    return response.data.data;
  }

  // Payment endpoints
  async getPayments(params?: any, signal?: AbortSignal): Promise<{ data: any[]; pagination: any }> {
    const response = await this.api.get<ApiResponse>('/payments', { params, signal });
    return {
      data: response.data.data || [],
      pagination: response.data.pagination
    };
  }

  async getPayment(id: string): Promise<any> {
    const response = await this.api.get<ApiResponse>(`/payments/${id}`);
    return response.data.data;
  }

  async createPayment(data: any): Promise<any> {
    const response = await this.api.post<ApiResponse>('/payments', data);
    return response.data.data;
  }

  async updatePayment(id: string, data: any): Promise<any> {
    const response = await this.api.put<ApiResponse>(`/payments/${id}`, data);
    return response.data.data;
  }

  async deletePayment(id: string): Promise<void> {
    await this.api.delete(`/payments/${id}`);
  }

  async recalculateMonthlyPayment(id: string, newAmount: number): Promise<any> {
    const response = await this.api.post<ApiResponse>(`/payments/${id}/recalculate`, { newAmount });
    return response.data.data;
  }

  async createMonthlyPayments(): Promise<any> {
    const response = await this.api.post<ApiResponse>('/payments/monthly/create');
    return response.data;
  }

  // Finance (раздел «Финансы»)
  async getFinanceTypes(): Promise<import('../types').FinanceOperationType[]> {
    const response = await this.api.get<ApiResponse>('/finance/types');
    return response.data.data || [];
  }

  async getFinanceRefs(): Promise<{
    types: import('../types').FinanceOperationType[];
    clients: import('../types').Client[];
    trainers: import('../types').Trainer[];
    groups: import('../types').Group[];
    branches: import('../types').Branch[];
  }> {
    const response = await this.api.get<ApiResponse>('/finance/refs');
    return response.data.data;
  }

  async createFinanceType(data: {
    name: string;
    code?: string;
    defaultDirection?: 'income' | 'expense';
  }): Promise<import('../types').FinanceOperationType> {
    const response = await this.api.post<ApiResponse>('/finance/types', data);
    return response.data.data;
  }

  async getFinanceOperations(params?: Record<string, any>): Promise<import('../types').FinanceOperationsResponse> {
    const response = await this.api.get<ApiResponse>('/finance/operations', { params });
    return (
      response.data.data || {
        items: [],
        total: 0,
        limit: 100,
        offset: 0,
      }
    );
  }

  async createFinanceOperation(data: {
    direction: 'income' | 'expense';
    typeCode: string;
    title: string;
    amount: number;
    occurredAt?: string;
    notes?: string;
    clientId?: string;
    trainerId?: string;
    groupId?: string;
    branchId?: string;
  }): Promise<import('../types').FinanceOperation> {
    const response = await this.api.post<ApiResponse>('/finance/operations', data);
    return response.data.data;
  }

  async deleteFinanceOperation(id: string): Promise<void> {
    await this.api.delete<ApiResponse>(`/finance/operations/${id}`);
  }

  async getFinanceSalarySummary(params?: Record<string, any>): Promise<import('../types').FinanceSalaryRow[]> {
    const response = await this.api.get<ApiResponse>('/finance/salary-summary', { params });
    return response.data.data || [];
  }

  async payoutTrainerSalary(data: {
    trainerId: string;
    amount: number;
    periodLabel?: string;
    occurredAt?: string;
    notes?: string;
  }): Promise<import('../types').FinanceOperation> {
    const response = await this.api.post<ApiResponse>('/finance/salary-payout', data);
    return response.data.data;
  }

  async getFinanceMembershipSummary(
    params?: Record<string, any>
  ): Promise<import('../types').FinanceMembershipRow[]> {
    const response = await this.api.get<ApiResponse>('/finance/membership-summary', { params });
    return response.data.data || [];
  }

  async receiveMembershipPayment(data: {
    paymentId?: string;
    clientId?: string;
    amount?: number;
    notes?: string;
  }): Promise<any> {
    const response = await this.api.post<ApiResponse>('/finance/membership-payments/receive', data);
    return response.data.data;
  }

  async updateMembershipFinanceAmount(data: {
    paymentId: string;
    amount: number;
    notes?: string;
  }): Promise<any> {
    const response = await this.api.put<ApiResponse>('/finance/membership-payments/amount', data);
    return response.data.data;
  }

  // Membership endpoints
  async getMemberships(params?: any, signal?: AbortSignal): Promise<{ data: any[]; pagination: any }> {
    const response = await this.api.get<ApiResponse>('/memberships', { params, signal });
    return {
      data: response.data.data || [],
      pagination: response.data.pagination
    };
  }

  async getMembership(id: string): Promise<any> {
    const response = await this.api.get<ApiResponse>(`/memberships/${id}`);
    return response.data.data;
  }

  async createMembership(data: any): Promise<any> {
    const response = await this.api.post<ApiResponse>('/memberships', data);
    return response.data.data;
  }

  async updateMembership(id: string, data: any): Promise<any> {
    const response = await this.api.put<ApiResponse>(`/memberships/${id}`, data);
    return response.data.data;
  }

  async deleteMembership(id: string): Promise<void> {
    await this.api.delete(`/memberships/${id}`);
  }

  // Client membership endpoints
  async getClientMemberships(params?: any): Promise<{ data: any[] }> {
    const response = await this.api.get<ApiResponse>('/client-memberships', { params });
    return {
      data: response.data.data || []
    };
  }

  async createClientMembership(data: any): Promise<any> {
    const response = await this.api.post<ApiResponse>('/client-memberships', data);
    return response.data.data;
  }

  async updateClientMembership(id: string, data: any): Promise<any> {
    const response = await this.api.put<ApiResponse>(`/client-memberships/${id}`, data);
    return response.data.data;
  }

  async markVisitUsed(id: string): Promise<any> {
    const response = await this.api.post<ApiResponse>(`/client-memberships/${id}/mark-visit`);
    return response.data.data;
  }

  async deleteClientMembership(id: string): Promise<void> {
    await this.api.delete(`/client-memberships/${id}`);
  }

  // Report endpoints
  async getDashboardStats(signal?: AbortSignal): Promise<any> {
    const response = await this.api.get<ApiResponse>('/reports/dashboard', { signal });
    return response.data.data;
  }

  async getRecentActivity(limit?: number, signal?: AbortSignal): Promise<any> {
    const response = await this.api.get<ApiResponse>('/reports/dashboard/activity', {
      params: { limit },
      signal
    });
    return response.data.data;
  }

  async getUpcomingTrainings(limit?: number, days?: number, signal?: AbortSignal): Promise<any> {
    const response = await this.api.get<ApiResponse>('/reports/dashboard/upcoming-trainings', {
      params: { limit, days },
      signal
    });
    return response.data.data;
  }

  async getRevenueReport(params?: any): Promise<any> {
    const response = await this.api.get<ApiResponse>('/reports/revenue', { params });
    return response.data.data;
  }

  async getAttendanceReport(params?: any): Promise<any> {
    const response = await this.api.get<ApiResponse>('/reports/attendance', { params });
    return response.data.data;
  }

  async getTrainerSalaryReport(params?: any): Promise<any> {
    const response = await this.api.get<ApiResponse>('/reports/trainer-salary', { params });
    return response.data.data;
  }

  // File upload
  async uploadFile(file: File, endpoint: string): Promise<any> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await this.api.post<ApiResponse>(endpoint, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    return response.data.data;
  }

  // Promo Code endpoints
  async getPromoCodes(params?: any, signal?: AbortSignal): Promise<{ data: any[]; pagination: any }> {
    const response = await this.api.get<ApiResponse>('/promo-codes', { params, signal });
    return {
      data: response.data.data || [],
      pagination: response.data.pagination
    };
  }

  async getPromoCode(id: string): Promise<any> {
    const response = await this.api.get<ApiResponse>(`/promo-codes/${id}`);
    return response.data.data;
  }

  async createPromoCode(data: any): Promise<any> {
    const response = await this.api.post<ApiResponse>('/promo-codes', data);
    return response.data.data;
  }

  async updatePromoCode(id: string, data: any): Promise<any> {
    const response = await this.api.put<ApiResponse>(`/promo-codes/${id}`, data);
    return response.data.data;
  }

  async deletePromoCode(id: string): Promise<void> {
    await this.api.delete(`/promo-codes/${id}`);
  }

  async getPromoCodeStats(id: string): Promise<any> {
    const response = await this.api.get<ApiResponse>(`/promo-codes/${id}/stats`);
    return response.data.data;
  }

  // Referral Link endpoints
  async getReferralLinks(params?: any, signal?: AbortSignal): Promise<{ data: any[]; pagination: any }> {
    const response = await this.api.get<ApiResponse>('/referral-links', { params, signal });
    return {
      data: response.data.data || [],
      pagination: response.data.pagination
    };
  }

  async getReferralLink(id: string): Promise<any> {
    const response = await this.api.get<ApiResponse>(`/referral-links/${id}`);
    return response.data.data;
  }

  async createReferralLink(data: any): Promise<any> {
    const response = await this.api.post<ApiResponse>('/referral-links', data);
    return response.data.data;
  }

  async updateReferralLink(id: string, data: any): Promise<any> {
    const response = await this.api.put<ApiResponse>(`/referral-links/${id}`, data);
    return response.data.data;
  }

  async deleteReferralLink(id: string): Promise<void> {
    await this.api.delete(`/referral-links/${id}`);
  }

  async getReferralLinkStats(id: string): Promise<any> {
    const response = await this.api.get<ApiResponse>(`/referral-links/${id}/stats`);
    return response.data.data;
  }

  async trackReferralClick(code: string, clientId?: string): Promise<any> {
    const response = await this.api.post<ApiResponse>(`/referral-links/track/${code}`, { clientId });
    return response.data.data;
  }

  // Marketer endpoints (require admin auth, not marketer auth)
  async getMarketers(params?: any, signal?: AbortSignal): Promise<{ data: any[]; pagination: any }> {
    // Use regular token for admin endpoints
    const regularToken = localStorage.getItem('token');
    const marketerToken = localStorage.getItem('marketerToken');
    
    // Temporarily use regular token if available
    const originalAuth = this.api.defaults.headers.common['Authorization'];
    const originalAuthStr = typeof originalAuth === 'string' ? originalAuth : '';
    
    if (regularToken && !originalAuthStr.includes(regularToken)) {
      this.api.defaults.headers.common['Authorization'] = `Bearer ${regularToken}`;
    }
    
    try {
      const response = await this.api.get<ApiResponse>('/marketers', { params, signal });
      return {
        data: response.data.data || [],
        pagination: response.data.pagination
      };
    } finally {
      // Restore original auth
      if (marketerToken) {
        this.api.defaults.headers.common['Authorization'] = `Bearer ${marketerToken}`;
      } else if (regularToken) {
        this.api.defaults.headers.common['Authorization'] = `Bearer ${regularToken}`;
      } else {
        delete this.api.defaults.headers.common['Authorization'];
      }
    }
  }

  async getMarketer(id: string): Promise<any> {
    const response = await this.api.get<ApiResponse>(`/marketers/${id}`);
    return response.data.data;
  }

  async createMarketer(data: any): Promise<any> {
    const response = await this.api.post<ApiResponse>('/marketers', data);
    return response.data.data;
  }

  async updateMarketer(id: string, data: any): Promise<any> {
    const response = await this.api.put<ApiResponse>(`/marketers/${id}`, data);
    return response.data.data;
  }

  async deleteMarketer(id: string): Promise<void> {
    await this.api.delete(`/marketers/${id}`);
  }

  async getMarketerStats(id: string): Promise<MarketerStatsSummary> {
    // If id is 'me', use the special endpoint for authenticated marketer
    const endpoint = id === 'me' ? '/marketers/me/stats' : `/marketers/${id}/stats`;
    const response = await this.api.get<ApiResponse<MarketerStatsSummary>>(endpoint);
    return response.data.data!;
  }

  // Promo Code Admin endpoints (require regular admin auth)
  async getPromoCodeAdmins(params?: any, signal?: AbortSignal): Promise<{ data: any[]; pagination: any }> {
    // Use regular token for admin endpoints
    const regularToken = localStorage.getItem('token');
    const promoCodeAdminToken = localStorage.getItem('promoCodeAdminToken');
    
    // Temporarily use regular token if available
    const originalAuth = this.api.defaults.headers.common['Authorization'];
    const originalAuthStr = typeof originalAuth === 'string' ? originalAuth : '';
    
    if (regularToken && !originalAuthStr.includes(regularToken)) {
      this.api.defaults.headers.common['Authorization'] = `Bearer ${regularToken}`;
    }
    
    try {
      const response = await this.api.get<ApiResponse>('/promo-code-admins', { params, signal });
      return {
        data: response.data.data || [],
        pagination: response.data.pagination
      };
    } finally {
      // Restore original auth
      if (promoCodeAdminToken) {
        this.api.defaults.headers.common['Authorization'] = `Bearer ${promoCodeAdminToken}`;
      } else if (regularToken) {
        this.api.defaults.headers.common['Authorization'] = `Bearer ${regularToken}`;
      } else {
        delete this.api.defaults.headers.common['Authorization'];
      }
    }
  }

  async getPromoCodeAdmin(id: string): Promise<any> {
    const response = await this.api.get<ApiResponse>(`/promo-code-admins/${id}`);
    return response.data.data;
  }

  async createPromoCodeAdmin(data: any): Promise<any> {
    const response = await this.api.post<ApiResponse>('/promo-code-admins', data);
    return response.data.data;
  }

  async updatePromoCodeAdmin(id: string, data: any): Promise<any> {
    const response = await this.api.put<ApiResponse>(`/promo-code-admins/${id}`, data);
    return response.data.data;
  }

  async deletePromoCodeAdmin(id: string): Promise<void> {
    await this.api.delete(`/promo-code-admins/${id}`);
  }

  // Settings
  async getSettings(): Promise<any> {
    const response = await this.api.get<ApiResponse>('/settings');
    return response.data;
  }

  async updateSettings(data: any): Promise<any> {
    const response = await this.api.put<ApiResponse>('/settings', data);
    return response.data;
  }

  async updateOnboardingStatus(data: { hasCompletedOnboarding?: boolean; onboardingDeclined?: boolean }): Promise<any> {
    const response = await this.api.post<ApiResponse>('/settings/onboarding', data);
    return response.data;
  }

  async approveParentAccount(parentId: string): Promise<any> {
    const response = await this.api.put<ApiResponse>(`/clients/parents/${parentId}/approve`);
    return response.data;
  }

  async resetMembershipFees(): Promise<any> {
    const response = await this.api.post<ApiResponse>('/settings/reset-membership-fees');
    return response.data;
  }


  // Subscription methods
  async getSubscription(): Promise<any> {
    const response = await this.api.get<ApiResponse>('/subscriptions');
    return response.data.data;
  }

  async validatePromoCode(promoCode: string, planType: string): Promise<any> {
    const response = await this.api.post<ApiResponse>('/subscriptions/validate-promo-code', {
      promoCode,
      planType,
    });
    return response.data.data;
  }

  async createSubscriptionPayment(planType: string, returnUrl?: string, promoCode?: string): Promise<any> {
    const response = await this.api.post<ApiResponse>('/subscriptions/payment', {
      planType,
      returnUrl,
      promoCode,
    });
    return response.data.data;
  }

  async updateSubscriptionPlan(planType: string): Promise<any> {
    const response = await this.api.put<ApiResponse>('/subscriptions/plan', {
      planType,
    });
    return response.data.data;
  }

  async checkResourceLimit(resource: string): Promise<any> {
    const response = await this.api.get<ApiResponse>(`/subscriptions/check-limit?resource=${resource}`);
    return response.data.data;
  }

  async getPlanUsage(): Promise<any> {
    const response = await this.api.get<ApiResponse>('/subscriptions/plan-usage');
    return response.data.data;
  }

  // Admin Dashboard methods
  async getAdminDashboard(): Promise<any> {
    const response = await this.api.get<ApiResponse>('/admin-dashboard');
    return response.data.data;
  }

  async updateAdminSettings(data: {
    reservePercentage?: number;
    reserveAmount?: number;
    /** Абсолютный путь к файлу ошибок сервера. */
    errorLogPath?: string | null;
  }): Promise<any> {
    const response = await this.api.put<ApiResponse>('/admin-dashboard/settings', data);
    return response.data.data;
  }

  async getTenantDetails(tenantId: string): Promise<any> {
    const response = await this.api.get<ApiResponse>(`/admin-dashboard/tenants/${tenantId}`);
    return response.data.data;
  }

  // Super Admin Auth methods
  async superAdminLogin(data: { email: string; password: string }): Promise<any> {
    const response = await this.api.post<ApiResponse>('/super-admin/auth/login', data);
    return response.data.data;
  }

  // Set token manually (for super admin)
  setToken(token: string | null): void {
    if (token) {
      localStorage.setItem('superAdminToken', token);
    } else {
      localStorage.removeItem('superAdminToken');
    }
  }

  // Admin Dashboard additional methods
  async getAllTenants(): Promise<any> {
    const response = await this.api.get<ApiResponse>('/admin-dashboard/tenants');
    return response.data.data;
  }

  async getTransactionHistory(params?: { type?: string; limit?: number; offset?: number; startDate?: string; endDate?: string; categoryId?: string }): Promise<any> {
    const response = await this.api.get<ApiResponse>('/admin-dashboard/transactions', { params });
    return response.data.data;
  }

  async createExpense(data: {
    amount: number;
    description: string;
    categoryId?: string;
    documentUrl?: string;
    isRecurring?: boolean;
    recurringPeriod?: string;
    nextDueDate?: string;
  }): Promise<any> {
    const response = await this.api.post<ApiResponse>('/admin-dashboard/expenses', data);
    return response.data.data;
  }

  async updateExpense(id: string, data: {
    amount?: number;
    description?: string;
    categoryId?: string;
    documentUrl?: string;
    isRecurring?: boolean;
    recurringPeriod?: string;
    nextDueDate?: string;
  }): Promise<any> {
    const response = await this.api.put<ApiResponse>(`/admin-dashboard/expenses/${id}`, data);
    return response.data.data;
  }

  async deleteExpense(id: string): Promise<void> {
    await this.api.delete(`/admin-dashboard/expenses/${id}`);
  }

  async getExpenseCategories(): Promise<any> {
    const response = await this.api.get<ApiResponse>('/admin-dashboard/expense-categories');
    return response.data.data;
  }

  async createExpenseCategory(data: { name: string; description?: string; color?: string }): Promise<any> {
    const response = await this.api.post<ApiResponse>('/admin-dashboard/expense-categories', data);
    return response.data.data;
  }

  async getAnalyticsByPeriod(params?: {
    period?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<any> {
    const response = await this.api.get<ApiResponse>('/admin-dashboard/analytics/period', { params });
    return response.data.data;
  }

  async getRevenueForecast(): Promise<any> {
    const response = await this.api.get<ApiResponse>('/admin-dashboard/analytics/forecast');
    return response.data.data;
  }

  async getKPIMetrics(period?: string): Promise<any> {
    const response = await this.api.get<ApiResponse>('/admin-dashboard/analytics/kpi', {
      params: { period },
    });
    return response.data.data;
  }

  async getAuditLogs(params?: {
    limit?: number;
    offset?: number;
    action?: string;
    entityType?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<any> {
    const response = await this.api.get<ApiResponse>('/admin-dashboard/audit-logs', { params });
    return response.data.data;
  }

  async getBudgetLimits(): Promise<any> {
    const response = await this.api.get<ApiResponse>('/admin-dashboard/budget/limits');
    return response.data.data;
  }

  async setBudgetLimit(data: {
    categoryId?: string;
    categoryName?: string;
    limitAmount: number;
    period: string;
  }): Promise<any> {
    const response = await this.api.post<ApiResponse>('/admin-dashboard/budget/limits', data);
    return response.data.data;
  }

  /* ---------------- Каталог тарифов ---------------- */

  /**
   * Список тарифов для панели супер-админа (включая архивные и индивидуальные).
   * Персоналу платформы доступен только на чтение.
   */
  async getPlanPrices(): Promise<SubscriptionPlanItem[]> {
    const response = await this.api.get<ApiResponse<SubscriptionPlanItem[]>>(
      '/admin-dashboard/plans/prices'
    );
    return response.data.data!;
  }

  /** Создание тарифа. `isPublic: false` — индивидуальный тариф. */
  async createPlan(data: {
    code: string;
    name: string;
    description?: string | null;
    price?: number | null;
    limits?: Record<string, number | 'unlimited'>;
    isPublic?: boolean;
    sortOrder?: number;
    supportLevel?: string | null;
  }): Promise<SubscriptionPlanItem> {
    const response = await this.api.post<ApiResponse<SubscriptionPlanItem>>(
      '/admin-dashboard/plans',
      data
    );
    return response.data.data!;
  }

  /** Изменение тарифа: название, цена, лимиты, публичность. Код неизменяем. */
  async updatePlan(
    code: string,
    data: {
      name?: string;
      description?: string | null;
      price?: number | null;
      limits?: Record<string, number | 'unlimited'>;
      isPublic?: boolean;
      isActive?: boolean;
      sortOrder?: number;
      supportLevel?: string | null;
    }
  ): Promise<SubscriptionPlanItem> {
    const response = await this.api.put<ApiResponse<SubscriptionPlanItem>>(
      `/admin-dashboard/plans/${encodeURIComponent(code)}`,
      data
    );
    return response.data.data!;
  }

  /** Архивация тарифа (мягкое удаление — история сохраняется). */
  async archivePlan(code: string): Promise<SubscriptionPlanItem> {
    const response = await this.api.post<ApiResponse<SubscriptionPlanItem>>(
      `/admin-dashboard/plans/${encodeURIComponent(code)}/archive`,
      {}
    );
    return response.data.data!;
  }

  /** Восстановление тарифа из архива. */
  async restorePlan(code: string): Promise<SubscriptionPlanItem> {
    const response = await this.api.post<ApiResponse<SubscriptionPlanItem>>(
      `/admin-dashboard/plans/${encodeURIComponent(code)}/restore`,
      {}
    );
    return response.data.data!;
  }

  /** Публичный каталог тарифов для страницы /pricing (без индивидуальных). */
  async getPublicPlans(): Promise<PublicPlanItem[]> {
    const response = await this.api.get<ApiResponse<PublicPlanItem[]>>('/subscriptions/plans');
    return response.data.data!;
  }

  /** Совместимость: обновление цены и лимитов существующего тарифа. */
  async updatePlanPrice(data: { planType: string; price?: number | null; limits?: any }): Promise<any> {
    const response = await this.api.put<ApiResponse>('/admin-dashboard/plans/prices', data);
    return response.data.data;
  }

  async getAdminMarketerStats(marketerId?: string): Promise<any> {
    const response = await this.api.get<ApiResponse>('/admin-dashboard/marketers/stats', {
      params: marketerId ? { marketerId } : {},
    });
    return response.data.data;
  }

  async bulkUpdateTenants(data: {
    tenantIds: string[];
    action: string;
    data?: any;
  }): Promise<any> {
    const response = await this.api.post<ApiResponse>('/admin-dashboard/tenants/bulk', data);
    return response.data;
  }

  /**
   * Выдача тарифа аккаунту. Применяется сразу, независимо от уровня тарифа.
   * `endDate` — необязательный срок действия, `comment` попадает в историю.
   */
  async updateTenantPlan(
    tenantId: string,
    planType: string,
    options?: { endDate?: string | null; comment?: string | null }
  ): Promise<any> {
    const response = await this.api.put<ApiResponse>(`/admin-dashboard/tenants/${tenantId}/plan`, {
      planType,
      ...(options?.endDate ? { endDate: options.endDate } : {}),
      ...(options?.comment ? { comment: options.comment } : {}),
    });
    return response.data.data;
  }

  /** Изменение срока действия тарифа аккаунта с записью в историю. */
  async updateTenantSubscriptionEndDate(
    tenantId: string,
    endDate: string,
    comment?: string | null
  ): Promise<any> {
    const response = await this.api.put<ApiResponse>(
      `/admin-dashboard/tenants/${tenantId}/subscription/end-date`,
      { endDate, ...(comment ? { comment } : {}) }
    );
    return response.data.data;
  }

  /** История выдачи и продления тарифов аккаунта. */
  async getTenantGrantHistory(tenantId: string): Promise<SubscriptionGrantLogItem[]> {
    const response = await this.api.get<ApiResponse<SubscriptionGrantLogItem[]>>(
      `/admin-dashboard/tenants/${tenantId}/grant-history`
    );
    return response.data.data!;
  }

  /* ---------------- Файл ошибок сервера ---------------- */

  /** Сведения о файле логов: путь, размер, дата изменения. */
  async getLogFileInfo(): Promise<LogFileInfoResponse> {
    const response = await this.api.get<ApiResponse<LogFileInfoResponse>>(
      '/admin-dashboard/logs/error-file'
    );
    return response.data.data!;
  }

  /** Последние строки файла логов. */
  async readLogFile(lines = 500): Promise<LogFileContentResponse> {
    const response = await this.api.get<ApiResponse<LogFileContentResponse>>(
      '/admin-dashboard/logs/error-file/content',
      { params: { lines } }
    );
    return response.data.data!;
  }

  /** Выгрузка файла логов. */
  async downloadLogFile(): Promise<Blob> {
    const response = await this.api.get('/admin-dashboard/logs/error-file/download', {
      responseType: 'blob',
    });
    return response.data as Blob;
  }

  /** Очистка файла логов. */
  async clearLogFile(): Promise<{ path: string; clearedBytes: number }> {
    const response = await this.api.delete<ApiResponse<{ path: string; clearedBytes: number }>>(
      '/admin-dashboard/logs/error-file'
    );
    return response.data.data!;
  }

  async payMarketer(data: { marketerId: string; amount: number; description?: string }): Promise<any> {
    const response = await this.api.post<ApiResponse>('/admin-dashboard/marketers/pay', data);
    return response.data.data;
  }

  async exportTransactions(params?: {
    type?: string;
    startDate?: string;
    endDate?: string;
    categoryId?: string;
  }): Promise<Blob> {
    const response = await this.api.get('/admin-dashboard/export/transactions', {
      params,
      responseType: 'blob',
    });
    return response.data;
  }

  async exportTenants(): Promise<Blob> {
    const response = await this.api.get('/admin-dashboard/export/tenants', {
      responseType: 'blob',
    });
    return response.data;
  }

  async exportMarketers(): Promise<Blob> {
    const response = await this.api.get('/admin-dashboard/export/marketers', {
      responseType: 'blob',
    });
    return response.data;
  }

  async getDashboardPresets(): Promise<any> {
    const response = await this.api.get<ApiResponse>('/admin-dashboard/dashboard/presets');
    return response.data.data;
  }

  async getDevNotes(params?: { status?: string }): Promise<any[]> {
    const response = await this.api.get<ApiResponse>('/admin-dashboard/dev-notes', { params });
    return response.data.data || [];
  }

  async createDevNote(data: {
    title: string;
    description?: string | null;
    status?: string;
  }): Promise<any> {
    const response = await this.api.post<ApiResponse>('/admin-dashboard/dev-notes', data);
    return response.data.data;
  }

  async updateDevNote(
    id: string,
    data: { title?: string; description?: string | null; status?: string }
  ): Promise<any> {
    const response = await this.api.put<ApiResponse>(`/admin-dashboard/dev-notes/${id}`, data);
    return response.data.data;
  }

  async deleteDevNote(id: string): Promise<void> {
    await this.api.delete(`/admin-dashboard/dev-notes/${id}`);
  }

  async uploadDevNoteAttachments(noteId: string, files: File[]): Promise<any[]> {
    const formData = new FormData();
    files.forEach((f) => formData.append('files', f));
    const response = await this.api.post<ApiResponse>(
      `/admin-dashboard/dev-notes/${noteId}/attachments`,
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 120000,
      }
    );
    return response.data.data || [];
  }

  async downloadDevNoteAttachment(
    noteId: string,
    attachmentId: string
  ): Promise<{ blob: Blob; filename: string }> {
    const response = await this.api.get(
      `/admin-dashboard/dev-notes/${noteId}/attachments/${attachmentId}/download`,
      { responseType: 'blob', timeout: 120000 }
    );
    const disposition = response.headers['content-disposition'] as string | undefined;
    const filename = parseContentDispositionFilename(disposition, 'file');
    return { blob: response.data, filename };
  }

  async deleteDevNoteAttachment(noteId: string, attachmentId: string): Promise<void> {
    await this.api.delete(`/admin-dashboard/dev-notes/${noteId}/attachments/${attachmentId}`);
  }

  async listClientContracts(clientId: string): Promise<any[]> {
    const response = await this.api.get<ApiResponse>(`/clients/${clientId}/contracts`);
    return response.data.data || [];
  }

  async uploadClientContract(
    clientId: string,
    file: File,
    meta?: { title?: string; signedAt?: string }
  ): Promise<any> {
    const formData = new FormData();
    formData.append('file', file);
    if (meta?.title) formData.append('title', meta.title);
    if (meta?.signedAt) formData.append('signedAt', meta.signedAt);
    const response = await this.api.post<ApiResponse>(`/clients/${clientId}/contracts`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000,
    });
    return response.data.data;
  }

  async downloadClientContract(
    clientId: string,
    contractId: string
  ): Promise<{ blob: Blob; filename: string }> {
    const response = await this.api.get(`/clients/${clientId}/contracts/${contractId}/download`, {
      responseType: 'blob',
      timeout: 120000,
    });
    const disposition = response.headers['content-disposition'] as string | undefined;
    const filename = parseContentDispositionFilename(disposition, 'contract.pdf');
    return { blob: response.data, filename };
  }

  async deleteClientContract(clientId: string, contractId: string): Promise<void> {
    await this.api.delete(`/clients/${clientId}/contracts/${contractId}`);
  }

  async uploadClientContractAddendum(
    clientId: string,
    contractId: string,
    file: File,
    meta?: { title?: string; signedAt?: string }
  ): Promise<any> {
    const formData = new FormData();
    formData.append('file', file);
    if (meta?.title) formData.append('title', meta.title);
    if (meta?.signedAt) formData.append('signedAt', meta.signedAt);
    const response = await this.api.post<ApiResponse>(
      `/clients/${clientId}/contracts/${contractId}/addenda`,
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 120000,
      }
    );
    return response.data.data;
  }

  async downloadClientContractAddendum(
    clientId: string,
    contractId: string,
    addendumId: string
  ): Promise<{ blob: Blob; filename: string }> {
    const response = await this.api.get(
      `/clients/${clientId}/contracts/${contractId}/addenda/${addendumId}/download`,
      { responseType: 'blob', timeout: 120000 }
    );
    const disposition = response.headers['content-disposition'] as string | undefined;
    const filename = parseContentDispositionFilename(disposition, 'addendum.pdf');
    return { blob: response.data, filename };
  }

  async deleteClientContractAddendum(
    clientId: string,
    contractId: string,
    addendumId: string
  ): Promise<void> {
    await this.api.delete(
      `/clients/${clientId}/contracts/${contractId}/addenda/${addendumId}`
    );
  }

  async clientListDocuments(clientId: string): Promise<{
    contracts: any[];
    personalDocs: {
      birthCertificate: boolean;
      birthCertificateNumber: string | null;
      medicalCertificate: boolean;
      medicalCertificateNumber: string | null;
    };
  }> {
    const response = await this.api.get<ApiResponse>(
      `/client-auth/clients/${clientId}/contracts`
    );
    return response.data.data;
  }

  async downloadClientCertificate(
    clientId: string,
    kind: 'birth' | 'medical'
  ): Promise<{ blob: Blob; filename: string }> {
    const response = await this.api.get(`/clients/${clientId}/certificates/${kind}/download`, {
      responseType: 'blob',
      timeout: 120000,
    });
    const disposition = response.headers['content-disposition'] as string | undefined;
    const fallback = kind === 'birth' ? 'birth-certificate' : 'medical-certificate';
    const filename = parseContentDispositionFilename(disposition, fallback);
    return { blob: response.data, filename };
  }

  async clientDownloadCertificate(
    clientId: string,
    kind: 'birth' | 'medical'
  ): Promise<{ blob: Blob; filename: string }> {
    const response = await this.api.get(
      `/client-auth/clients/${clientId}/certificates/${kind}/download`,
      { responseType: 'blob', timeout: 120000 }
    );
    const disposition = response.headers['content-disposition'] as string | undefined;
    const fallback = kind === 'birth' ? 'birth-certificate' : 'medical-certificate';
    const filename = parseContentDispositionFilename(disposition, fallback);
    return { blob: response.data, filename };
  }

  async clientDownloadContract(
    clientId: string,
    contractId: string
  ): Promise<{ blob: Blob; filename: string }> {
    const response = await this.api.get(
      `/client-auth/clients/${clientId}/contracts/${contractId}/download`,
      { responseType: 'blob', timeout: 120000 }
    );
    const disposition = response.headers['content-disposition'] as string | undefined;
    const filename = parseContentDispositionFilename(disposition, 'contract.pdf');
    return { blob: response.data, filename };
  }

  async clientDownloadContractAddendum(
    clientId: string,
    contractId: string,
    addendumId: string
  ): Promise<{ blob: Blob; filename: string }> {
    const response = await this.api.get(
      `/client-auth/clients/${clientId}/contracts/${contractId}/addenda/${addendumId}/download`,
      { responseType: 'blob', timeout: 120000 }
    );
    const disposition = response.headers['content-disposition'] as string | undefined;
    const filename = parseContentDispositionFilename(disposition, 'addendum.pdf');
    return { blob: response.data, filename };
  }

  async getPlannerEvents(params: { from: string; to: string }): Promise<{
    from: string;
    to: string;
    occurrences: Array<{
      occurrenceAt: string;
      event: {
        id: string;
        title: string;
        notes?: string | null;
        startAt: string;
        allDay: boolean;
        intervalUnit: 'NONE' | 'DAY' | 'WEEK' | 'MONTH' | 'YEAR';
        intervalCount: number;
        seriesEndAt?: string | null;
        createdBy?: { id: string; firstName: string; lastName: string; email: string };
      };
    }>;
    series: any[];
  }> {
    const response = await this.api.get<ApiResponse>('/admin-dashboard/planner/events', { params });
    return response.data.data;
  }

  async createPlannerEvent(data: {
    title: string;
    notes?: string | null;
    startAt: string;
    allDay?: boolean;
    intervalUnit?: string;
    intervalCount?: number;
    seriesEndAt?: string | null;
  }): Promise<any> {
    const response = await this.api.post<ApiResponse>('/admin-dashboard/planner/events', data);
    return response.data.data;
  }

  async updatePlannerEvent(
    id: string,
    data: {
      title?: string;
      notes?: string | null;
      startAt?: string;
      allDay?: boolean;
      intervalUnit?: string;
      intervalCount?: number;
      seriesEndAt?: string | null;
    }
  ): Promise<any> {
    const response = await this.api.put<ApiResponse>(`/admin-dashboard/planner/events/${id}`, data);
    return response.data.data;
  }

  async deletePlannerEvent(id: string): Promise<void> {
    await this.api.delete(`/admin-dashboard/planner/events/${id}`);
  }

  async linkTenantOwnerAsSuperAdmin(tenantId: string): Promise<any> {
    const response = await this.api.post<ApiResponse>(
      `/admin-dashboard/tenants/${tenantId}/link-super-admin`
    );
    return response.data.data;
  }

  async unlinkTenantOwnerSuperAdmin(tenantId: string): Promise<any> {
    const response = await this.api.delete<ApiResponse>(
      `/admin-dashboard/tenants/${tenantId}/link-super-admin`
    );
    return response.data.data;
  }

  async linkTenantOwnerAsTester(tenantId: string): Promise<any> {
    const response = await this.api.post<ApiResponse>(
      `/admin-dashboard/tenants/${tenantId}/link-tester`
    );
    return response.data.data;
  }

  async unlinkTenantOwnerTester(tenantId: string): Promise<any> {
    const response = await this.api.delete<ApiResponse>(
      `/admin-dashboard/tenants/${tenantId}/link-tester`
    );
    return response.data.data;
  }

  async saveDashboardPreset(data: {
    id?: string;
    name: string;
    isDefault?: boolean;
    widgetOrder: string[];
    widgetVisibility: Record<string, boolean>;
  }): Promise<any> {
    const response = await this.api.post<ApiResponse>('/admin-dashboard/dashboard/presets', data);
    return response.data.data;
  }

  async deleteDashboardPreset(id: string): Promise<void> {
    await this.api.delete(`/admin-dashboard/dashboard/presets/${id}`);
  }

  // Server metrics (super-admin)
  async getServerMetricsLive(): Promise<any> {
    const response = await this.api.get<ApiResponse>('/admin-dashboard/server-metrics/live');
    return response.data.data;
  }

  async getServerMetricsHistory(range: '1h' | '6h' | '24h' | '7d' | '30d' = '1h'): Promise<any> {
    const response = await this.api.get<ApiResponse>('/admin-dashboard/server-metrics/history', {
      params: { range },
    });
    return response.data.data;
  }

  async getServerAlertSettings(): Promise<any> {
    const response = await this.api.get<ApiResponse>('/admin-dashboard/server-metrics/alert-settings');
    return response.data.data;
  }

  async updateServerAlertSettings(data: {
    alertsEnabled?: boolean;
    alertCpuPercent?: number;
    alertMemoryPercent?: number;
    alertDiskPercent?: number;
    alertLoadPerCore?: number;
    alertCooldownMinutes?: number;
  }): Promise<any> {
    const response = await this.api.put<ApiResponse>('/admin-dashboard/server-metrics/alert-settings', data);
    return response.data.data;
  }

  async getServerMetricsVapidKey(): Promise<string | null> {
    const response = await this.api.get<ApiResponse>('/admin-dashboard/server-metrics/vapid-key');
    return response.data.data?.publicKey || null;
  }

  async subscribeSuperAdminPush(subscription: any, userAgent?: string): Promise<any> {
    const response = await this.api.post<ApiResponse>('/admin-dashboard/server-metrics/push/subscribe', {
      subscription,
      userAgent,
    });
    return response.data;
  }

  async unsubscribeSuperAdminPush(endpoint: string): Promise<any> {
    const response = await this.api.post<ApiResponse>('/admin-dashboard/server-metrics/push/unsubscribe', {
      endpoint,
    });
    return response.data;
  }

  async getSuperAdminPushStatus(): Promise<{
    subscribed: boolean;
    count: number;
    vapidConfigured: boolean;
  }> {
    const response = await this.api.get<ApiResponse>('/admin-dashboard/server-metrics/push/status');
    return response.data.data;
  }

  // Client auth endpoints
  async findClientsForRegistration(phone?: string, email?: string): Promise<any> {
    const response = await this.api.post<ApiResponse>('/client-auth/find', { phone, email });
    return response.data.data;
  }

  async registerClient(clientId: string, tenantId: string, password: string): Promise<any> {
    const response = await this.api.post<ApiResponse>('/client-auth/register', {
      clientId,
      tenantId,
      password
    });
    return response.data;
  }

  async findParentsForRegistration(phone?: string, email?: string): Promise<any> {
    const response = await this.api.post<ApiResponse>('/client-auth/parent/find', { phone, email });
    return response.data.data;
  }

  async registerParent(parentId: string, tenantId: string, password: string): Promise<any> {
    const response = await this.api.post<ApiResponse>('/client-auth/parent/register', {
      parentId,
      tenantId,
      password
    });
    return response.data;
  }

  async loginClient(phone: string | undefined, email: string | undefined, password: string, tenantId: string): Promise<any> {
    const response = await this.api.post<ApiResponse>('/client-auth/login', {
      phone,
      email,
      password,
      tenantId
    });
    return response.data.data;
  }

  async getClientProfile(): Promise<any> {
    const response = await this.api.get<ApiResponse>('/client-auth/profile');
    return response.data.data;
  }

  /** Карточка спортсмена в ЛК (только свой / linked athlete). */
  async getAthleteCard(clientId?: string): Promise<any> {
    const response = await this.api.get<ApiResponse>('/client-auth/athlete-card', {
      params: clientId ? { clientId } : undefined,
    });
    return response.data.data;
  }

  /** Календарь ЛК: свои тренировки + соревнования, где клиент участник. */
  async getClientCalendarPlan(params?: {
    clientId?: string;
    from?: string;
    to?: string;
  }): Promise<{
    clientId: string;
    from: string;
    to: string;
    trainings: any[];
    competitions: any[];
  }> {
    const response = await this.api.get<ApiResponse>('/client-auth/calendar-plan', { params });
    return response.data.data!;
  }

  /** Платежи ЛК: только выставленные выбранному спортсмену. */
  async getClientPayments(clientId?: string): Promise<any[]> {
    const response = await this.api.get<ApiResponse>('/client-auth/payments', {
      params: clientId ? { clientId } : undefined,
    });
    return (response.data.data as any[]) || [];
  }

  /** Данные для панели управления клиента/родителя (учитывает подтверждение школой). */
  async getClientDashboard(clientId?: string): Promise<ClientDashboardData> {
    const response = await this.api.get<ApiResponse<ClientDashboardData>>('/client-auth/dashboard', {
      params: clientId ? { clientId } : undefined,
    });
    return response.data.data!;
  }

  async approveClientAccount(clientId: string): Promise<any> {
    const response = await this.api.put<ApiResponse>(`/clients/${clientId}/approve-account`);
    return response.data.data;
  }

  async rejectClientAccount(clientId: string): Promise<any> {
    const response = await this.api.put<ApiResponse>(`/clients/${clientId}/reject-account`);
    return response.data.data;
  }

  async globalSearch(q: string): Promise<{
    clients: Array<{ id: string; type: 'client'; title: string; subtitle?: string }>;
    trainers: Array<{ id: string; type: 'trainer'; title: string; subtitle?: string }>;
    groups: Array<{ id: string; type: 'group'; title: string; subtitle?: string }>;
  }> {
    const response = await this.api.get<ApiResponse>('/search', { params: { q } });
    return response.data.data || { clients: [], trainers: [], groups: [] };
  }

  async getClientTrainings(startDate?: string, endDate?: string): Promise<any> {
    const params: any = {};
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    const response = await this.api.get<ApiResponse>('/client-auth/trainings', { params });
    return response.data.data;
  }

  // Клиент: техподдержка / дизайн
  async clientCreateSupportTicket(body: { channel: 'SUPPORT' | 'DESIGNER'; subject?: string; message: string }): Promise<any> {
    const response = await this.api.post<ApiResponse>('/client-auth/support/tickets', body);
    return response.data.data;
  }

  async clientListSupportTickets(): Promise<any> {
    const response = await this.api.get<ApiResponse>('/client-auth/support/tickets');
    return response.data.data;
  }

  async clientGetSupportTicketMessages(ticketId: string): Promise<any> {
    const response = await this.api.get<ApiResponse>(`/client-auth/support/tickets/${ticketId}/messages`);
    return response.data.data;
  }

  async clientPostSupportMessage(ticketId: string, message: string): Promise<any> {
    const response = await this.api.post<ApiResponse>(`/client-auth/support/tickets/${ticketId}/messages`, { message });
    return response.data.data;
  }

  // Non-client support (tenant users / marketers / promo admins)
  async requesterCreateSupportTicket(body: {
    channel?: 'SUPPORT' | 'DESIGNER';
    subject?: string;
    message: string;
  }): Promise<any> {
    const response = await this.api.post<ApiResponse>('/support/tickets', body);
    return response.data.data;
  }

  async requesterListSupportTickets(params?: { channel?: 'SUPPORT' | 'DESIGNER' }): Promise<any> {
    const response = await this.api.get<ApiResponse>('/support/tickets', { params });
    return response.data.data;
  }

  async requesterGetSupportTicketMessages(ticketId: string): Promise<any> {
    const response = await this.api.get<ApiResponse>(`/support/tickets/${ticketId}/messages`);
    return response.data.data;
  }

  async requesterPostSupportMessage(ticketId: string, message: string): Promise<any> {
    const response = await this.api.post<ApiResponse>(`/support/tickets/${ticketId}/messages`, { message });
    return response.data.data;
  }

  async requesterUploadDesignerRecording(ticketId: string, formData: FormData): Promise<any> {
    const response = await this.api.post<ApiResponse>(`/support/tickets/${ticketId}/recordings`, formData);
    return response.data.data;
  }

  async platformStaffLogin(email: string, password: string): Promise<any> {
    const response = await this.api.post<ApiResponse>('/platform-staff/auth/login', { email, password });
    return response.data.data;
  }

  async platformStaffChangePassword(currentPassword: string, newPassword: string): Promise<void> {
    await this.api.post<ApiResponse>('/platform-staff/auth/change-password', { currentPassword, newPassword });
  }

  async platformStaffListTickets(params?: { status?: string; channel?: string }): Promise<any> {
    const response = await this.api.get<ApiResponse>('/platform-staff/tickets', { params });
    return response.data.data;
  }

  async platformStaffClaimTicket(ticketId: string): Promise<any> {
    const response = await this.api.post<ApiResponse>(`/platform-staff/tickets/${ticketId}/claim`, {});
    return response.data.data;
  }

  async platformStaffGetMessages(ticketId: string): Promise<any> {
    const response = await this.api.get<ApiResponse>(`/platform-staff/tickets/${ticketId}/messages`);
    return response.data.data;
  }

  async platformStaffPostMessage(ticketId: string, message: string): Promise<any> {
    const response = await this.api.post<ApiResponse>(`/platform-staff/tickets/${ticketId}/messages`, { message });
    return response.data.data;
  }

  async platformStaffListKnowledge(): Promise<any> {
    const response = await this.api.get<ApiResponse>('/platform-staff/knowledge');
    return response.data.data;
  }

  async platformStaffUploadRecording(formData: FormData): Promise<any> {
    const response = await this.api.post<ApiResponse>('/platform-staff/recordings', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data.data;
  }

  async superAdminListSupportTickets(params?: { channel?: string; tenantId?: string }): Promise<any> {
    const response = await this.api.get<ApiResponse>('/super-admin/support/tickets', { params });
    return response.data.data;
  }

  async superAdminGetSupportTicketDetail(ticketId: string): Promise<any> {
    const response = await this.api.get<ApiResponse>(`/super-admin/support/tickets/${ticketId}`);
    return response.data.data;
  }

  async superAdminPostSupportMessage(ticketId: string, message: string): Promise<any> {
    const response = await this.api.post<ApiResponse>(`/super-admin/support/tickets/${ticketId}/messages`, { message });
    return response.data.data;
  }

  async superAdminListDesignerRecordings(): Promise<any> {
    const response = await this.api.get<ApiResponse>('/super-admin/support/recordings');
    return response.data.data;
  }

  async superAdminDownloadDesignerRecording(
    id: string
  ): Promise<{ blob: Blob; filename: string }> {
    const response = await this.api.get(`/super-admin/support/recordings/${id}/download`, {
      responseType: 'blob',
      timeout: 120000,
    });
    const disposition = response.headers['content-disposition'] as string | undefined;
    const filename = parseContentDispositionFilename(disposition, `recording-${id}.webm`);
    return { blob: response.data, filename };
  }

  async superAdminDeleteDesignerRecording(id: string): Promise<void> {
    await this.api.delete(`/super-admin/support/recordings/${id}`);
  }

  async superAdminListSupportKnowledge(): Promise<any> {
    const response = await this.api.get<ApiResponse>('/super-admin/support/knowledge');
    return response.data.data;
  }

  async superAdminCreateSupportKnowledge(payload: { title: string; body: string; category?: string; sortOrder?: number }): Promise<any> {
    const response = await this.api.post<ApiResponse>('/super-admin/support/knowledge', payload);
    return response.data.data;
  }

  async superAdminCreatePlatformStaffUser(payload: { email: string; role: 'SUPPORT' | 'DESIGNER' | 'SECURITY'; firstName: string; lastName: string }): Promise<any> {
    const response = await this.api.post<ApiResponse>('/super-admin/support/platform-staff/users', payload);
    return response.data.data;
  }

  /* ------------------------------------------------------------------ */
  /* Внутришкольные чаты                                                */
  /* ------------------------------------------------------------------ */

  async listChatThreads(): Promise<any[]> {
    const response = await this.api.get<ApiResponse>('/chats/threads');
    return response.data.data || [];
  }

  async getChatUnreadTotal(): Promise<{ total: number }> {
    const response = await this.api.get<ApiResponse>('/chats/unread-total');
    return response.data.data || { total: 0 };
  }

  async ensureChatThread(data: {
    type: string;
    clientId?: string;
    trainerId?: string;
    groupId?: string;
  }): Promise<any> {
    const response = await this.api.post<ApiResponse>('/chats/threads/ensure', data);
    return response.data.data;
  }

  async getChatMessages(threadId: string, params?: { before?: string; limit?: number }): Promise<any> {
    const response = await this.api.get<ApiResponse>(`/chats/threads/${threadId}/messages`, { params });
    return response.data.data;
  }

  async sendChatMessage(threadId: string, body: string): Promise<any> {
    const response = await this.api.post<ApiResponse>(`/chats/threads/${threadId}/messages`, { body });
    return response.data.data;
  }

  async editChatMessage(threadId: string, messageId: string, body: string): Promise<any> {
    const response = await this.api.patch<ApiResponse>(
      `/chats/threads/${threadId}/messages/${messageId}`,
      { body }
    );
    return response.data.data;
  }

  async markChatRead(threadId: string): Promise<any> {
    const response = await this.api.post<ApiResponse>(`/chats/threads/${threadId}/read`, {});
    return response.data.data;
  }

  async clientListChatThreads(): Promise<any[]> {
    const response = await this.api.get<ApiResponse>('/client-auth/chats/threads');
    return response.data.data || [];
  }

  async clientGetChatUnreadTotal(): Promise<{ total: number }> {
    const response = await this.api.get<ApiResponse>('/client-auth/chats/unread-total');
    return response.data.data || { total: 0 };
  }

  async clientEnsureChatThread(data: {
    type: string;
    clientId?: string;
    trainerId?: string;
    groupId?: string;
  }): Promise<any> {
    const response = await this.api.post<ApiResponse>('/client-auth/chats/threads/ensure', data);
    return response.data.data;
  }

  async clientGetChatMessages(threadId: string, params?: { before?: string; limit?: number }): Promise<any> {
    const response = await this.api.get<ApiResponse>(`/client-auth/chats/threads/${threadId}/messages`, {
      params,
    });
    return response.data.data;
  }

  async clientSendChatMessage(threadId: string, body: string): Promise<any> {
    const response = await this.api.post<ApiResponse>(`/client-auth/chats/threads/${threadId}/messages`, {
      body,
    });
    return response.data.data;
  }

  async clientEditChatMessage(threadId: string, messageId: string, body: string): Promise<any> {
    const response = await this.api.patch<ApiResponse>(
      `/client-auth/chats/threads/${threadId}/messages/${messageId}`,
      { body }
    );
    return response.data.data;
  }

  async clientMarkChatRead(threadId: string): Promise<any> {
    const response = await this.api.post<ApiResponse>(`/client-auth/chats/threads/${threadId}/read`, {});
    return response.data.data;
  }

  /* ------------------------------------------------------------------ */
  /* Платформенные чаты и changelog                                     */
  /* ------------------------------------------------------------------ */

  async listPlatformChatThreads(): Promise<any[]> {
    const response = await this.api.get<ApiResponse>('/platform/chats/threads');
    return response.data.data || [];
  }

  async ensurePlatformChatThread(data: { type: string }): Promise<any> {
    const response = await this.api.post<ApiResponse>('/platform/chats/threads/ensure', data);
    return response.data.data;
  }

  async getPlatformChatMessages(threadId: string, params?: { before?: string; limit?: number }): Promise<any> {
    const response = await this.api.get<ApiResponse>(`/platform/chats/threads/${threadId}/messages`, {
      params,
    });
    return response.data.data;
  }

  async sendPlatformChatMessage(threadId: string, body: string): Promise<any> {
    const response = await this.api.post<ApiResponse>(`/platform/chats/threads/${threadId}/messages`, {
      body,
    });
    return response.data.data;
  }

  async editPlatformChatMessage(threadId: string, messageId: string, body: string): Promise<any> {
    const response = await this.api.patch<ApiResponse>(
      `/platform/chats/threads/${threadId}/messages/${messageId}`,
      { body }
    );
    return response.data.data;
  }

  async markPlatformChatRead(threadId: string): Promise<any> {
    const response = await this.api.post<ApiResponse>(`/platform/chats/threads/${threadId}/read`, {});
    return response.data.data;
  }

  async listPlatformChangelog(): Promise<any[]> {
    const response = await this.api.get<ApiResponse>('/platform/changelog');
    return response.data.data || [];
  }

  async createPlatformChangelog(data: { title: string; body: string }): Promise<any> {
    const response = await this.api.post<ApiResponse>('/platform/changelog', data);
    return response.data.data;
  }

  async updatePlatformChangelog(id: string, data: { title?: string; body?: string }): Promise<any> {
    const response = await this.api.put<ApiResponse>(`/platform/changelog/${id}`, data);
    return response.data.data;
  }

  async deletePlatformChangelog(id: string): Promise<any> {
    const response = await this.api.delete<ApiResponse>(`/platform/changelog/${id}`);
    return response.data.data;
  }
}

export const apiService = new ApiService();
