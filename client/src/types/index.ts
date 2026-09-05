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

/** Ответ POST /auth/unified-staff-login */
export type UnifiedStaffLoginResponse =
  | ({ accountType: 'TENANT_USER' } & AuthResponse)
  | {
      accountType: 'MARKETER';
      marketer: { id: string; email: string; name: string; type: string; tenantId: string };
      tenant: Tenant;
      token: string;
    }
  | {
      accountType: 'PROMO_CODE_ADMIN';
      admin: { id: string; email: string; name: string; tenantId: string };
      tenant: Tenant;
      token: string;
    }
  | {
      accountType: 'SUPER_ADMIN';
      superAdmin: { id: string; email: string; firstName: string; lastName: string };
      token: string;
    }
  | {
      accountType: 'PLATFORM_STAFF';
      staff: { id: string; email: string; firstName: string; lastName: string; role: string; mustChangePassword?: boolean };
      token: string;
    };

/* ------------------------------------------------------------------ */
/* Единая авторизация                                                  */
/* ------------------------------------------------------------------ */

/** Все типы аккаунтов единой авторизации. */
export type AccountType =
  | 'TENANT_USER'
  | 'CLIENT'
  | 'PARENT'
  | 'MARKETER'
  | 'PROMO_CODE_ADMIN'
  | 'SUPER_ADMIN'
  | 'PLATFORM_STAFF';

export type IdentifierType = 'phone' | 'email';

export interface TenantBrief {
  id: string;
  name: string;
  subdomain: string;
}

/** Ответ POST /auth/identify — шаг 1. */
export interface IdentifyResponse {
  identifierType: IdentifierType;
  identifier: string;
  exists: boolean;
  /** true → показываем экран «Придумайте пароль». */
  needsPasswordSetup: boolean;
  accountsCount: number;
}

/** Аккаунт для экрана выбора организации. */
export interface PublicAccount {
  accountType: AccountType;
  id: string;
  displayName: string;
  role?: string;
  tenant?: TenantBrief;
  isAccountApproved: boolean;
  /** ФИО ребёнка — для родителей. */
  childName?: string;
}

/** Выданная сессия. */
export interface UnifiedSession {
  requiresSelection: false;
  accountType: AccountType;
  token: string;
  tenant?: TenantBrief;
  user?: User;
  client?: any;
  parent?: any;
  marketer?: any;
  admin?: any;
  superAdmin?: any;
  staff?: { id: string; email: string; firstName: string; lastName: string; role: string; mustChangePassword?: boolean };
  isAccountApproved?: boolean;
}

/** Нужен выбор организации/роли. */
export interface UnifiedSelectionRequired {
  requiresSelection: true;
  selectionToken: string;
  clientAccounts: PublicAccount[];
  staffAccounts: PublicAccount[];
}

export type UnifiedLoginResponse = UnifiedSession | UnifiedSelectionRequired;

/* ------------------------------------------------------------------ */
/* Каталог тарифов (панель супер-админа)                               */
/* ------------------------------------------------------------------ */

/** Лимит тарифа: число или «безлимит». */
export type PlanLimitValue = number | 'unlimited';

export interface PlanLimitsDto {
  trainers: PlanLimitValue;
  clients: PlanLimitValue;
  groups: PlanLimitValue;
  branches: PlanLimitValue;
  trainings: PlanLimitValue;
}

/** Тариф в панели супер-админа. */
export interface SubscriptionPlanItem {
  /** Совместимость с прежним интерфейсом — то же, что code. */
  planType: string;
  /** Неизменяемый код тарифа, связывает его с историей платежей. */
  code: string;
  name: string;
  description: string | null;
  /** null — «Цена договорная». */
  price: number | null;
  isNegotiable: boolean;
  limits: PlanLimitsDto;
  /** false — индивидуальный тариф, не показывается на странице тарифов. */
  isPublic: boolean;
  /** false — тариф в архиве, выдать его нельзя. */
  isActive: boolean;
  sortOrder: number;
  supportLevel: string | null;
  /** Сколько аккаунтов используют тариф. */
  subscriptionsCount: number;
}

/** Тариф для публичной страницы /pricing. */
export interface PublicPlanItem {
  code: string;
  planType: string;
  name: string;
  description: string | null;
  price: number | null;
  isNegotiable: boolean;
  limits: PlanLimitsDto;
  supportLevel: string | null;
  sortOrder: number;
}

/** Запись в истории выдачи и продления тарифа. */
export interface SubscriptionGrantLogItem {
  id: string;
  /** 'grant' — выдача, 'extend' — изменение срока. */
  action: string;
  planCode: string;
  planName: string;
  oldPlanCode: string | null;
  oldPlanName: string | null;
  oldEndDate: string | null;
  newEndDate: string | null;
  comment: string | null;
  createdAt: string;
  superAdmin: { id: string; name: string; email: string } | null;
}

/* ------------------------------------------------------------------ */
/* Файл логов сервера                                                  */
/* ------------------------------------------------------------------ */

export interface LogFileInfoResponse {
  path: string;
  exists: boolean;
  size: number;
  sizeHuman: string;
  modifiedAt: string | null;
  writable: boolean;
  defaultPath: string;
}

export interface LogFileContentResponse {
  path: string;
  exists: boolean;
  size: number;
  sizeHuman: string;
  modifiedAt: string | null;
  lines: number;
  /** true — показан только хвост файла. */
  truncated: boolean;
  content: string;
}

/* ------------------------------------------------------------------ */
/* Личный кабинет клиента/родителя                                     */
/* ------------------------------------------------------------------ */

export interface ClientDashboardStaffMember {
  id: string;
  /** «Тренер», «Администратор», «Владелец». */
  roleLabel: string;
  name: string;
  phone: string | null;
  email: string | null;
}

export interface ClientDashboardEvent {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  groupName: string | null;
  color: string | null;
  branchName: string | null;
  hallName: string | null;
  trainerName: string | null;
}

export interface ClientDashboardData {
  /** false → показываем экран ожидания подтверждения с заглушками. */
  isAccountApproved: boolean;
  userType: 'client' | 'parent';
  viewerName: string;
  parent: { id: string; fullName: string; phone: string | null; email: string | null } | null;
  tenant: (TenantBrief & { logo?: string | null }) | null;
  client?: {
    id: string;
    firstName: string;
    lastName: string;
    middleName?: string | null;
    email?: string | null;
    phone?: string | null;
    photo?: string | null;
    membershipFeePaid: boolean;
  };
  balance: { amount: number; nextCharge: { date: string; amount: number } | null } | null;
  attendance: { present: number; total: number } | null;
  staff: ClientDashboardStaffMember[];
  groups: Array<{ id?: string; name?: string; color?: string | null; branchName: string | null }>;
  weekRange?: { start: string; end: string };
  upcomingTrainings: ClientDashboardEvent[];
  monthEvents: ClientDashboardEvent[];
  /** Спортсмены на одном номере — переключатель в шапке. */
  linkedAthletes?: Array<{ id: string; firstName: string; lastName: string }>;
  activeClientId?: string;
}

// Client Types
export interface Parent {
  id: string;
  fullName: string;
  phone?: string;
  email?: string;
  workplace?: string;
  workplaceContact?: string;
  relationType?: 'mother' | 'father' | 'guardian' | 'other' | string;
  isPrimaryContact?: boolean;
  clientId: string;
  createdAt: string;
  updatedAt: string;
  // Поля для регистрации
  hasPassword?: boolean;
  password?: string;
  isAccountApproved?: boolean;
  accountApprovedAt?: string;
  accountApprovedBy?: string;
  lastLogin?: string;
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
  discipline?: string;
  weightCategory?: string;
  athleteStatus?: 'active' | 'pause' | 'injury' | 'left' | string;
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
  // Задолженность
  debt?: number;
  overduePaymentsCount?: number;
  isActive: boolean;
  /** Есть ли установленный пароль ЛК (без самого хеша). */
  hasPassword?: boolean;
  isAccountApproved?: boolean;
  accountApprovedAt?: string;
  accountApprovedBy?: string;
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
  salaryType: 'percentage' | 'per_student' | 'fixed' | 'per_training' | 'individual'
    | 'per_training_person' | 'fixed_per_student_month' | 'percent_month' | 'fixed_monthly';
  salaryAmount?: number;
  salaryScheme?: 'per_training_person' | 'fixed_per_student_month' | 'percent_month' | 'fixed_monthly';
  salaryRate?: number;
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
export interface GroupScheduleItem {
  dayOfWeek: number; // 0 = воскресенье, 1 = понедельник, ..., 6 = суббота
  startTime: string; // Формат "HH:mm"
  endTime: string; // Формат "HH:mm"
}

export interface Group {
  id: string;
  name: string;
  description?: string;
  maxMembers?: number;
  ageMin?: number;
  ageMax?: number;
  color?: string; // Цвет для отображения в расписании (hex формат)
  trainingPrice?: number; // Стоимость одной тренировки в группе
  schedule?: GroupScheduleItem[]; // График тренировок по дням недели
  isActive: boolean;
  branchId: string;
  trainerId: string;
  // Ежемесячная оплата
  isMonthlyPayment?: boolean;
  monthlyPaymentAmount?: number;
  paymentDueDay?: number; // День месяца для оплаты (1-31)
  // Настройки зарплаты тренера
  trainerSalaryType?: 'monthly_percentage' | 'per_visit_percentage' | 'per_visit_amount';
  trainerMonthlyPercentage?: number; // Процент от ежемесячной суммы оплаченной клиентами
  trainerPerVisitPercentage?: number; // Процент за посещение
  trainerPerVisitAmount?: number; // Фиксированная сумма за посещение
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
  groupId?: string; // Связь с группой для ежемесячных платежей
  isMonthlyPayment?: boolean; // Является ли это ежемесячным платежом
  originalAmount?: number; // Оригинальная сумма до перерасчета
  client?: Client;
  membership?: Membership;
  group?: Group;
}

/* ------------------------------------------------------------------ */
/* Раздел «Финансы»                                                    */
/* ------------------------------------------------------------------ */

export type FinanceDirection = 'income' | 'expense';

export interface FinanceOperationType {
  id: string;
  tenantId?: string | null;
  code: string;
  name: string;
  defaultDirection: FinanceDirection | string;
  isSystem: boolean;
  isActive: boolean;
}

export interface FinanceOperation {
  id: string;
  direction: FinanceDirection | string;
  typeCode: string;
  typeName?: string;
  title: string;
  amount: number;
  occurredAt: string;
  notes?: string | null;
  clientId?: string | null;
  trainerId?: string | null;
  groupId?: string | null;
  branchId?: string | null;
  paymentId?: string | null;
  client?: { id: string; firstName: string; lastName: string; middleName?: string | null } | null;
  trainer?: { id: string; firstName: string; lastName: string } | null;
  group?: { id: string; name: string } | null;
  branch?: { id: string; name: string } | null;
}

export interface FinanceOperationsResponse {
  items: FinanceOperation[];
  total: number;
  limit: number;
  offset: number;
}

export interface FinanceSalaryRow {
  trainerId: string;
  trainerName: string;
  periodStart: string;
  periodEnd: string;
  trainingsCount: number;
  trainingsMode?: 'all' | 'conducted';
  accrued: number;
  paid: number;
  remaining: number;
}

export interface FinanceMembershipRow {
  clientId: string;
  clientName: string;
  membershipPrice: number;
  paidAmount: number;
  debt: number;
  remaining: number;
  status: 'paid' | 'unpaid' | 'partial';
  latestPaymentId: string | null;
  groups: Array<{ id: string; name: string; trainerId?: string; branchId?: string }>;
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
  groupId?: string; // Опционально для индивидуальных тренировок
  trainerId: string;
  // Цена и тип заработка тренера для индивидуальных тренировок
  price?: number;
  trainerEarningType?: 'percentage' | 'amount';
  trainerEarningValue?: number; // Процент или сумма
  // Замена тренера
  substituteTrainerId?: string; // ID тренера-замены
  originalTrainerId?: string; // ID оригинального тренера (если есть замена)
  branch?: Branch;
  hall?: Hall;
  group?: Group;
  trainer?: Trainer;
  substituteTrainer?: Trainer; // Тренер-замена
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
