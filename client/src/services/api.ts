import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { ApiResponse, AuthResponse, LoginForm, RegisterForm, MarketerStatsSummary } from '../types';

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
        const promoCodeAdminToken = localStorage.getItem('promoCodeAdminToken');
        const marketerToken = localStorage.getItem('marketerToken');
        const regularToken = localStorage.getItem('token');
        
        if (superAdminToken) {
          config.headers.Authorization = `Bearer ${superAdminToken}`;
        } else if (promoCodeAdminToken) {
          config.headers.Authorization = `Bearer ${promoCodeAdminToken}`;
        } else if (marketerToken) {
          config.headers.Authorization = `Bearer ${marketerToken}`;
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
            window.location.href = '/super-admin/login';
          } else if (isMarketerRoute) {
            localStorage.removeItem('marketerToken');
            localStorage.removeItem('marketer');
            localStorage.removeItem('marketerTenant');
            window.location.href = '/marketer/login';
          } else if (isPromoCodeAdminRoute) {
            localStorage.removeItem('promoCodeAdminToken');
            localStorage.removeItem('promoCodeAdmin');
            localStorage.removeItem('promoCodeAdminTenant');
            window.location.href = '/promo-code-admin/login';
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

  async changePassword(data: { currentPassword: string; newPassword: string }): Promise<void> {
    await this.api.post('/auth/change-password', data);
  }

  async requestPasswordReset(email: string): Promise<void> {
    await this.api.post('/auth/request-password-reset', { email });
  }

  async resetPassword(data: { token: string; newPassword: string }): Promise<void> {
    await this.api.post('/auth/reset-password', data);
  }

  // Client endpoints
  async getClients(params?: any, signal?: AbortSignal): Promise<{ data: any[]; pagination: any }> {
    const response = await this.api.get<ApiResponse>('/clients', { params, signal });
    return {
      data: response.data.data || [],
      pagination: response.data.pagination
    };
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
  async getTrainers(params?: any, signal?: AbortSignal): Promise<{ data: any[]; pagination: any }> {
    const response = await this.api.get<ApiResponse>('/trainers', { params, signal });
    return {
      data: response.data.data || [],
      pagination: response.data.pagination
    };
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
  async getGroups(params?: any, signal?: AbortSignal): Promise<{ data: any[]; pagination: any }> {
    const response = await this.api.get<ApiResponse>('/groups', { params, signal });
    return {
      data: response.data.data || [],
      pagination: response.data.pagination
    };
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
  async getBranches(params?: any, signal?: AbortSignal): Promise<{ data: any[]; pagination: any }> {
    const response = await this.api.get<ApiResponse>('/branches', { params, signal });
    return {
      data: response.data.data || [],
      pagination: response.data.pagination
    };
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

  async updateTraining(id: string, data: any): Promise<any> {
    const response = await this.api.put<ApiResponse>(`/trainings/${id}`, data);
    return response.data.data;
  }

  async deleteTraining(id: string): Promise<void> {
    await this.api.delete(`/trainings/${id}`);
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

  // Client Categories
  async getClientCategories(): Promise<any> {
    const response = await this.api.get<ApiResponse>('/client-categories');
    return response.data;
  }

  async getClientCategory(id: string): Promise<any> {
    const response = await this.api.get<ApiResponse>(`/client-categories/${id}`);
    return response.data.data;
  }

  async createClientCategory(data: any): Promise<any> {
    const response = await this.api.post<ApiResponse>('/client-categories', data);
    return response.data.data;
  }

  async updateClientCategory(id: string, data: any): Promise<any> {
    const response = await this.api.put<ApiResponse>(`/client-categories/${id}`, data);
    return response.data.data;
  }

  async deleteClientCategory(id: string): Promise<void> {
    await this.api.delete(`/client-categories/${id}`);
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
}

export const apiService = new ApiService();
