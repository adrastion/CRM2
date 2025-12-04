import { Request } from 'express';
import { User, Tenant } from '@prisma/client';

// Extended Request interface with user and tenant
export interface AuthenticatedRequest extends Request {
  user?: User;
  tenant?: Tenant;
  tenantId?: string;
}

// JWT Payload interface
export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  tenantId: string;
  iat?: number;
  exp?: number;
}

// API Response interface
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Pagination interface
export interface PaginationQuery {
  page?: string;
  limit?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// Search and filter interfaces
export interface SearchQuery extends PaginationQuery {
  search?: string;
  filter?: string;
}

// Client interfaces
export interface CreateParentData {
  fullName: string;
  phone?: string;
  email?: string;
  workplace?: string;
  workplaceContact?: string;
}

export interface CreateClientData {
  firstName: string;
  lastName: string;
  middleName?: string;
  email?: string;
  phone?: string;
  dateOfBirth?: string;
  gender?: string;
  address?: string;
  birthCertificateNumber?: string;
  medicalCertificateNumber?: string;
  schoolOrKindergarten?: string;
  // Паспорт РФ
  passportSeries?: string | null;
  passportNumber?: string | null;
  passportIssueDate?: string | null;
  passportIssuedBy?: string | null;
  passportDivisionCode?: string | null;
  passportBirthPlace?: string | null;
  parents?: CreateParentData[];
}

export interface UpdateClientData extends Partial<Omit<CreateClientData, 'parents'>> {
  isActive?: boolean;
  parents?: CreateParentData[];
}

// Trainer interfaces
export interface CreateTrainerData {
  userId: string;
  qualification?: string;
  experience?: number;
  specialization?: string;
  salaryType: 'fixed' | 'percentage';
  salaryAmount?: number;
}

// Group interfaces
export interface GroupScheduleItem {
  dayOfWeek: number; // 0 = воскресенье, 1 = понедельник, ..., 6 = суббота
  startTime: string; // Формат "HH:mm"
  endTime: string; // Формат "HH:mm"
}

export interface CreateGroupData {
  name: string;
  description?: string;
  maxMembers?: number;
  ageMin?: number;
  ageMax?: number;
  color?: string; // Цвет для отображения в расписании (hex формат)
  schedule?: GroupScheduleItem[]; // График тренировок по дням недели
  branchId: string;
  trainerId: string;
}

// Membership interfaces
export interface CreateMembershipData {
  name: string;
  description?: string;
  price: number;
  duration?: number; // days (для месячных абонементов)
  visits?: number; // количество посещений (для абонементов на количество раз)
  type: string;
}

// Payment interfaces
export interface CreatePaymentData {
  amount: number;
  type: string;
  paymentMethod?: string;
  notes?: string;
  dueDate?: string;
  clientId: string;
  membershipId?: string;
}

// Training interfaces
export interface CreateTrainingData {
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  isRecurring?: boolean;
  recurrence?: string;
  branchId: string;
  groupId: string;
  trainerId: string;
}

// Attendance interfaces
export interface CreateAttendanceData {
  status: 'PRESENT' | 'ABSENT' | 'EXCUSED';
  notes?: string;
  clientId: string;
  trainingId: string;
}

// Report interfaces
export interface RevenueReport {
  period: string;
  totalRevenue: number;
  membershipRevenue: number;
  singlePaymentRevenue: number;
  branchBreakdown: Array<{
    branchId: string;
    branchName: string;
    revenue: number;
  }>;
}

export interface AttendanceReport {
  period: string;
  totalTrainings: number;
  totalAttendances: number;
  attendanceRate: number;
  clientBreakdown: Array<{
    clientId: string;
    clientName: string;
    attendanceRate: number;
  }>;
}

export interface TrainerSalaryReport {
  period: string;
  trainers: Array<{
    trainerId: string;
    trainerName: string;
    salaryType: string;
    salaryAmount: number;
    totalTrainings: number;
    calculatedSalary: number;
  }>;
}

// Dashboard interfaces
export interface DashboardStats {
  totalClients: number;
  activeClients: number;
  totalTrainers: number;
  totalGroups: number;
  totalBranches: number;
  monthlyRevenue: number;
  attendanceRate: number;
  upcomingTrainings: number;
  trainerMonthlyEarnings?: number;
}

// File upload interfaces
export interface FileUpload {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  destination: string;
  filename: string;
  path: string;
}

// Email interfaces
export interface EmailData {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

// Validation error interface
export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}
