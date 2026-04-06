import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { ApiResponse, AuthResponse, LoginForm, RegisterForm, MarketerStatsSummary, UnifiedStaffLoginResponse } from '../types';
import { apiCache, generateCacheKey } from '../utils/apiCache';

class ApiService {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: process.env.REACT_APP_API_URL || '/api',
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor to add auth token
    this.api.interceptors.request.use(
      (config) => {
        // Check for super admin token first (for admin dashboard routes)
        const superAdminToken = localStorage.getItem('superAdminToken');
        const platformStaffToken = localStorage.getItem('platformStaffToken');
        const promoCodeAdminToken = localStorage.getItem('promoCodeAdminToken');
        const marketerToken = localStorage.getItem('marketerToken');
        const clientToken = localStorage.getItem('clientToken');
        const regularToken = localStorage.getItem('token');
        
        if (superAdminToken) {
          config.headers.Authorization = `Bearer ${superAdminToken}`;
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
        
        if (error.response?.status === 401) {
          // Token expired or invalid
          const url = error.config?.url || '';
          
          // Don't redirect on login endpoints - let them handle the error
          const isLoginEndpoint = url.includes('/auth/login') || 
                                 url.includes('/auth/unified-staff-login') ||
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
          
          // Check if it's a marketer route (marketers/me/stats, or any /marketers route with marketer token)
          const isMarketerRoute = url.includes('/marketers/me/') || 
                                  (url.includes('/marketers/') && localStorage.getItem('marketerToken'));
          
          // Check if it's a promo code admin route
          const isPromoCodeAdminRoute = url.includes('/promo-codes') || 
                                        url.includes('/referral-links') ||
                                        (url.includes('/marketers/') && !localStorage.getItem('marketerToken') && localStorage.getItem('promoCodeAdminToken'));
          
          if (isSuperAdminRoute) {
            localStorage.removeItem('superAdminToken');
            localStorage.removeItem('superAdmin');
            window.location.href = '/login';
          } else if (isMarketerRoute) {
            localStorage.removeItem('marketerToken');
            localStorage.removeItem('marketer');
            localStorage.removeItem('marketerTenant');
            window.location.href = '/login';
          } else if (isPromoCodeAdminRoute) {
            localStorage.removeItem('promoCodeAdminToken');
            localStorage.removeItem('promoCodeAdmin');
            localStorage.removeItem('promoCodeAdminTenant');
            window.location.href = '/login';
          } else if (url.includes('/platform-staff/')) {
            localStorage.removeItem('platformStaffToken');
            localStorage.removeItem('platformStaff');
            window.location.href = '/login';
          } else if (url.includes('/client-auth/')) {
            localStorage.removeItem('clientToken');
            localStorage.removeItem('client');
            localStorage.removeItem('clientTenant');
            window.location.href = '/client/login';
          } else {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            localStorage.removeItem('tenant');
            window.location.href = '/login';
          }
        }
        return Promise.reject(error);
      }
    );
  }

  // Auth endpoints
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

  async requestPasswordReset(email: string): Promise<void> {
    await this.api.post('/auth/request-password-reset', { email });
  }

  async resetPassword(data: { token: string; newPassword: string }): Promise<void> {
    await this.api.post('/auth/reset-password', data);
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

  async updateAdminSettings(data: { reservePercentage?: number; reserveAmount?: number }): Promise<any> {
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

  async getPlanPrices(): Promise<any> {
    const response = await this.api.get<ApiResponse>('/admin-dashboard/plans/prices');
    return response.data.data;
  }

  async updatePlanPrice(data: { planType: string; price?: number; limits?: any }): Promise<any> {
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

  async updateTenantPlan(tenantId: string, planType: string): Promise<any> {
    const response = await this.api.put<ApiResponse>(`/admin-dashboard/tenants/${tenantId}/plan`, { planType });
    return response.data.data;
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

  async approveClientAccount(clientId: string): Promise<any> {
    const response = await this.api.put<ApiResponse>(`/clients/${clientId}/approve-account`);
    return response.data.data;
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
}

export const apiService = new ApiService();
