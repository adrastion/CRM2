// User and Authentication Types
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  phone?: string;
  role: 'OWNER' | 'ADMIN' | 'TRAINER';
  tenantId: string;
}

export interface Tenant {
  id: string;
  name: string;
  subdomain: string;
  email: string;
  phone?: string;
  address?: string;
  logo?: string;
  settings?: any;
}

export interface AuthResponse {
  user: User;
  tenant: Tenant;
  token: string;
}

// Client Types
export interface Parent {
  id: string;
  fullName: string;
  phone?: string;
  email?: string;
  workplace?: string;
  workplaceContact?: string;
  clientId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Client {
  id: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  email?: string;
  phone?: string;
  dateOfBirth?: string;
  gender?: string;
  address?: string;
  birthCertificateNumber?: string;
  birthCertificate?: string; // Фото/документ свидетельства о рождении (base64)
  medicalCertificateNumber?: string;
  medicalCertificate?: string; // Фото/документ справки (base64)
  schoolOrKindergarten?: string;
  emergencyContact?: string;
  emergencyPhone?: string;
  medicalNotes?: string;
  photo?: string;
  weight?: number;
  // Паспорт РФ
  passportSeries?: string;
  passportNumber?: string;
  passportIssueDate?: string;
  passportIssuedBy?: string;
  passportDivisionCode?: string;
  passportBirthPlace?: string;
  balance?: number;
  membershipFeePaid?: boolean;
  membershipFeePaidAt?: string;
  membershipFeePaidBy?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  achievements?: Achievement[];
  groupMemberships?: GroupMembership[];
  memberships?: Payment[];
  parents?: Parent[];
  attendances?: Attendance[];
}

export interface Achievement {
  id: string;
  title: string;
  description?: string;
  date: string;
  type: string;
  clientId: string;
}

// Standard Types (Нормативы)
export interface Standard {
  id: string;
  name: string;
  description?: string;
  unit?: string; // Единица измерения (раз, секунды, метры, кг и т.д.)
  targetValue?: number; // Целевое значение
  category?: string; // Категория/тип норматива
  isActive: boolean;
  tenantId: string;
  createdAt: string;
  updatedAt: string;
  _count?: {
    clientStandards: number;
  };
}

export interface ClientStandard {
  id: string;
  clientId: string;
  standardId: string;
  completedAt: string; // Дата выполнения
  result?: number; // Результат выполнения (числовое значение)
  resultText?: string; // Текстовый результат
  status: 'completed' | 'failed' | 'pending';
  notes?: string; // Комментарии/заметки
  createdAt: string;
  updatedAt: string;
  client?: Client;
  standard?: Standard;
}

// Trainer Types
export interface Trainer {
  id: string;
  userId: string;
  qualification?: string;
  experience?: number;
  specialization?: string;
  salaryType: 'percentage' | 'per_student' | 'fixed' | 'per_training' | 'individual';
  salaryAmount?: number;
  salaryPercentage?: number; // Для individual типа (процент от индивидуального занятия)
  balance?: number;
  canViewAllGroups?: boolean;
  isActive: boolean;
  user?: User;
  branches?: TrainerBranch[];
}

export interface TrainerBranch {
  id: string;
  trainerId: string;
  branchId: string;
  createdAt: string;
  branch?: Branch;
  trainer?: Trainer;
}

// Group Types
export interface Group {
  id: string;
  name: string;
  description?: string;
  maxMembers?: number;
  ageMin?: number;
  ageMax?: number;
  color?: string; // Цвет для отображения в расписании (hex формат)
  trainingPrice?: number; // Стоимость одной тренировки в группе
  isActive: boolean;
  branchId: string;
  trainerId: string;
  branch?: Branch;
  trainer?: Trainer;
  memberships?: GroupMembership[];
}

export interface GroupMembership {
  id: string;
  clientId: string;
  groupId: string;
  joinedAt: string;
  leftAt?: string;
  isActive: boolean;
  client?: Client;
  group?: Group;
}

// Branch Types
export interface Branch {
  id: string;
  name: string;
  address: string;
  phone?: string;
  email?: string;
  description?: string;
  isActive: boolean;
  tenantId: string;
}

// Hall Types
export interface Hall {
  id: string;
  name: string;
  description?: string;
  capacity?: number;
  isActive: boolean;
  branchId: string;
  tenantId: string;
  branch?: Branch;
}

// Membership Types
export interface Membership {
  id: string;
  name: string;
  description?: string;
  price: number;
  duration?: number; // days (для месячных абонементов)
  visits?: number; // количество посещений (для абонементов на количество раз)
  type: string;
  isActive: boolean;
  tenantId: string;
}

// Payment Types
export interface Payment {
  id: string;
  amount: number;
  type: string;
  branchId?: string;
  branch?: Branch;
  status: 'pending' | 'paid' | 'cancelled' | 'refunded';
  paymentMethod?: string;
  notes?: string;
  dueDate?: string;
  paidAt?: string;
  createdAt?: string;
  clientId: string;
  membershipId?: string;
  client?: Client;
  membership?: Membership;
}

// Training Types
export interface Training {
  id: string;
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  isRecurring: boolean;
  recurrence?: string;
  isCancelled: boolean;
  branchId: string;
  hallId?: string;
  groupId: string;
  trainerId: string;
  branch?: Branch;
  hall?: Hall;
  group?: Group;
  trainer?: Trainer;
}

// Attendance Types
export interface Attendance {
  id: string;
  status: 'PRESENT' | 'ABSENT' | 'EXCUSED';
  notes?: string;
  shouldCharge?: boolean; // Списывать ли средства с клиента (для пропусков)
  clientId: string;
  trainingId: string;
  createdAt?: string;
  updatedAt?: string;
  client?: Client;
  training?: Training;
}

// Competition Types
export interface Competition {
  id: string;
  name: string;
  location: string;
  startDate: string;
  endDate: string;
  registrationDate: string;
  registrationTime?: string;
  isElectronicRegistration: boolean;
  positionDocument?: string; // Положение о соревновании (base64)
  regulationsDocument?: string; // Регламент (base64)
  tenantId: string;
  createdAt?: string;
  updatedAt?: string;
  participants?: CompetitionParticipant[];
  results?: CompetitionResult[];
  trainers?: CompetitionTrainer[];
  attendances?: CompetitionAttendance[];
}

export interface CompetitionParticipant {
  id: string;
  competitionId: string;
  clientId: string;
  tenantId: string;
  createdAt?: string;
  updatedAt?: string;
  competition?: Competition;
  client?: Client;
  results?: CompetitionResult[];
  attendance?: CompetitionAttendance;
}

export interface CompetitionResult {
  id: string;
  competitionId: string;
  participantId: string;
  result?: string; // Результат (текст)
  resultValue?: number; // Результат (число)
  category?: string; // Категория (опционально)
  performanceTime?: string; // Время категории (выступления)
  createdAt?: string;
  updatedAt?: string;
  competition?: Competition;
  participant?: CompetitionParticipant;
}

export interface CompetitionTrainer {
  id: string;
  competitionId: string;
  trainerId: string;
  tenantId: string;
  createdAt?: string;
  updatedAt?: string;
  competition?: Competition;
  trainer?: Trainer;
}

export interface CompetitionAttendance {
  id: string;
  competitionId: string;
  participantId: string;
  status: 'PRESENT' | 'ABSENT' | 'EXCUSED';
  notes?: string;
  tenantId: string;
  createdAt?: string;
  updatedAt?: string;
  competition?: Competition;
  participant?: CompetitionParticipant;
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  pagination?: Pagination;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// Dashboard Types
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

// Form Types
export interface LoginForm {
  email: string;
  password: string;
}

export interface RegisterForm {
  tenantName: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
}

export interface ParentForm {
  fullName: string;
  phone?: string;
  email?: string;
  workplace?: string;
  workplaceContact?: string;
}

export interface CreateClientForm {
  // Данные ребенка
  firstName: string;
  lastName: string;
  middleName?: string;
  email?: string;
  phone?: string;
  dateOfBirth?: string;
  gender?: string;
  address?: string;
  birthCertificateNumber?: string;
  birthCertificate?: string; // Фото/документ свидетельства о рождении (base64)
  medicalCertificateNumber?: string;
  medicalCertificate?: string; // Фото/документ справки (base64)
  schoolOrKindergarten?: string;
  // Родители
  parents?: ParentForm[];
}

// Navigation Types
export interface NavItem {
  label: string;
  path: string;
  icon: string;
  roles?: string[];
}

// Calendar Types
export interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource?: any;
  color?: string;
}

// Marketer Types
export interface Marketer {
  id: string;
  name: string;
  email: string;
  phone?: string;
  type: 'MARKETER' | 'MEDIA_PARTNER';
  isActive: boolean;
  tenantId: string;
  createdAt: string;
  updatedAt: string;
  promoCodes?: PromoCode[];
  referralLinks?: ReferralLink[];
}

export interface PromoCodeAdmin {
  id: string;
  name: string;
  email: string;
  phone?: string;
  isActive: boolean;
  tenantId: string;
  createdAt: string;
  updatedAt: string;
}

export interface MarketerStatsSummary {
  marketer: {
    id: string;
    name: string;
    email: string;
    type: string;
  };
  promoCodes: {
    total: number;
    active: number;
    totalUsages: number;
    totalDiscountGiven: number;
  };
  referralLinks: {
    total: number;
    active: number;
    totalClicks: number;
    totalConversions: number;
    conversionRate: number;
  };
}

// Promo Code Types
export interface PromoCode {
  id: string;
  code: string;
  description?: string;
  discountType: 'PERCENTAGE' | 'FIXED';
  discountValue: number;
  minPurchase?: number;
  maxDiscount?: number;
  usageLimit?: number;
  usedCount: number;
  isActive: boolean;
  validFrom: string;
  validUntil?: string;
  tenantId: string;
  marketerId?: string;
  createdAt: string;
  updatedAt: string;
  marketer?: Marketer;
  usages?: PromoCodeUsage[];
  stats?: {
    totalUsages: number;
    totalDiscount: number;
    remainingUsages?: number;
    isExpired: boolean;
    isActive: boolean;
  };
}

export interface PromoCodeUsage {
  id: string;
  promoCodeId: string;
  clientId?: string;
  paymentId?: string;
  usedAt: string;
  discountAmount: number;
  tenantId: string;
  client?: Client;
  payment?: Payment;
}

// Referral Link Types
export interface ReferralLink {
  id: string;
  code: string;
  name: string;
  description?: string;
  url: string;
  isActive: boolean;
  tenantId: string;
  marketerId?: string;
  createdAt: string;
  updatedAt: string;
  marketer?: Marketer;
  clicks?: ReferralClick[];
  stats?: {
    totalClicks: number;
    conversions: number;
    conversionRate: number;
  };
}

export interface ReferralClick {
  id: string;
  referralLinkId: string;
  clientId?: string;
  ipAddress?: string;
  userAgent?: string;
  clickedAt: string;
  converted: boolean;
  conversionDate?: string;
  tenantId: string;
  client?: Client;
}
