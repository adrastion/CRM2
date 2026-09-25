import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import { createAppTheme } from './theme/muiTheme';
import { CssBaseline, Box, CircularProgress } from '@mui/material';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { MarketerAuthProvider, useMarketerAuth } from './contexts/MarketerAuthContext';
import { PromoCodeAdminAuthProvider, usePromoCodeAdminAuth } from './contexts/PromoCodeAdminAuthContext';
import { SuperAdminAuthProvider, useSuperAdminAuth } from './contexts/SuperAdminAuthContext';
import { TesterAuthProvider, useTesterAuth } from './contexts/TesterAuthContext';
import { PlatformStaffAuthProvider, usePlatformStaffAuth } from './contexts/PlatformStaffAuthContext';
import AppLayout from './components/Layout/AppLayout';
import InteractiveOnboarding from './components/InteractiveOnboarding';
import { apiService } from './services/api';
import SupportFAB from './components/SupportFAB';
import SiteTrafficTracker from './components/SiteTrafficTracker';
import CookieConsentBanner from './components/CookieConsentBanner';
import { currentSessionDestination, hasAnySession } from './utils/authSession';

// Lazy load pages for better performance
const Landing = lazy(() => import('./pages/Landing'));
const Auth = lazy(() => import('./pages/Auth'));
const Register = lazy(() => import('./pages/Register'));
const PartnerRegister = lazy(() => import('./pages/PartnerRegister'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Clients = lazy(() => import('./pages/Clients'));
const Trainers = lazy(() => import('./pages/Trainers'));
const TrainerEarnings = lazy(() => import('./pages/TrainerEarnings'));
const TrainerProfile = lazy(() => import('./pages/TrainerProfile'));
const AllTrainersEarnings = lazy(() => import('./pages/AllTrainersEarnings'));
const Groups = lazy(() => import('./pages/Groups'));
const Schedule = lazy(() => import('./pages/Schedule'));
const Finance = lazy(() => import('./pages/Finance'));
const Memberships = lazy(() => import('./pages/Memberships'));
const FAQWrapper = lazy(() => import('./components/FAQWrapper'));
const KnowledgeBase = lazy(() => import('./pages/KnowledgeBase'));
const Maintenance = lazy(() => import('./pages/Maintenance'));
const TermsOfServiceWrapper = lazy(() => import('./components/TermsOfServiceWrapper'));
const PrivacyPolicyWrapper = lazy(() => import('./components/PrivacyPolicyWrapper'));
const ContactsWrapper = lazy(() => import('./components/ContactsWrapper'));
const PricingWrapper = lazy(() => import('./components/PricingWrapper'));
const SubscriptionSuccess = lazy(() => import('./pages/SubscriptionSuccess'));
const AdminPromoCodes = lazy(() => import('./pages/AdminPromoCodes'));
const MarketerRegister = lazy(() => import('./pages/MarketerRegister'));
const MarketerDashboard = lazy(() => import('./pages/marketer/MarketerDashboard'));
const MarketerClients = lazy(() => import('./pages/marketer/MarketerClients'));
const MarketerClientCard = lazy(() => import('./pages/marketer/MarketerClientCard'));
const MarketerTasks = lazy(() => import('./pages/marketer/MarketerTasks'));
const MarketerCalendar = lazy(() => import('./pages/marketer/MarketerCalendar'));
const MarketerChats = lazy(() => import('./pages/marketer/MarketerChats'));
const MarketerFinance = lazy(() => import('./pages/marketer/MarketerFinance'));
const MarketerAds = lazy(() => import('./pages/marketer/MarketerAds'));
const ReferralLanding = lazy(() => import('./pages/ReferralLanding'));
const Settings = lazy(() => import('./pages/Settings'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const SuperAdminSupportHub = lazy(() => import('./pages/SuperAdminSupportHub'));
const PlatformStaffDesk = lazy(() => import('./pages/PlatformStaffDesk'));
const PlatformStaffChangePassword = lazy(() => import('./pages/PlatformStaffChangePassword'));
const ClientRegister = lazy(() => import('./pages/ClientRegister'));
const ClientDashboard = lazy(() => import('./pages/ClientDashboard'));
const ParentRegister = lazy(() => import('./pages/ParentRegister'));
const Chats = lazy(() => import('./pages/Chats'));
const StaffWorkspace = lazy(() => import('./pages/StaffWorkspace'));
const TrainingPlan = lazy(() => import('./pages/TrainingPlan'));
const TesterDashboard = lazy(() => import('./pages/TesterDashboard'));

const appTheme = createAppTheme();

// Loading component
const PageLoader: React.FC = () => (
  <Box
    display="flex"
    justifyContent="center"
    alignItems="center"
    minHeight="100vh"
  >
    <CircularProgress />
  </Box>
);

// Protected Route Component
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  // Clear other tokens if trying to access regular routes
  React.useEffect(() => {
    const marketerToken = localStorage.getItem('marketerToken');
    const promoCodeAdminToken = localStorage.getItem('promoCodeAdminToken');
    const superAdminToken = localStorage.getItem('superAdminToken');
    const platformStaffToken = localStorage.getItem('platformStaffToken');
    if (marketerToken || promoCodeAdminToken || superAdminToken || platformStaffToken) {
      // User is trying to access regular routes but has other tokens
      // Clear it to prevent conflicts
      if (marketerToken) {
        localStorage.removeItem('marketerToken');
        localStorage.removeItem('marketer');
        localStorage.removeItem('marketerTenant');
        sessionStorage.setItem('marketerLoggedOut', 'true');
      }
      if (promoCodeAdminToken) {
        localStorage.removeItem('promoCodeAdminToken');
        localStorage.removeItem('promoCodeAdmin');
        localStorage.removeItem('promoCodeAdminTenant');
      }
      if (superAdminToken) {
        localStorage.removeItem('superAdminToken');
        localStorage.removeItem('superAdmin');
      }
      if (platformStaffToken) {
        localStorage.removeItem('platformStaffToken');
        localStorage.removeItem('platformStaff');
      }
    }
  }, []);

  if (isLoading) {
    return <PageLoader />;
  }

  return isAuthenticated ? <>{children}</> : <Navigate to="/auth" replace />;
};

/** Доступ только для указанных ролей школьного кабинета. */
const RoleRoute: React.FC<{ roles: string[]; children: React.ReactNode }> = ({ roles, children }) => {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <PageLoader />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  const roleOk =
    !!user &&
    (roles.includes(user.role) ||
      (Boolean(user.isSeniorTrainer || (user.seniorBranchIds && user.seniorBranchIds.length > 0)) &&
        roles.includes('ADMIN') &&
        !roles.includes('TRAINER')));

  if (!roleOk) {
    return <Navigate to={user?.role === 'PROMOTER' ? '/clients' : '/dashboard'} replace />;
  }

  return <>{children}</>;
};

/** Корень сайта: гости → лендинг, авторизованные → свой кабинет. */
const HomeRoute: React.FC = () => {
  const closedOrTestingStub =
    sessionStorage.getItem('closedTestingMode') === '1' ||
    (sessionStorage.getItem('testingMode') === '1' &&
      sessionStorage.getItem('testingModeAccess') !== '1') ||
    sessionStorage.getItem('maintenanceMode') === '1';

  // Пока Gate ещё проверяет статус — не светим лендинг в закрытых режимах
  if (closedOrTestingStub && !hasAnySession() && !localStorage.getItem('superAdminToken')) {
    return <Navigate to="/maintenance" replace />;
  }

  if (hasAnySession()) {
    const dest = currentSessionDestination();
    return <Navigate to={dest || '/dashboard'} replace />;
  }
  return <Landing />;
};

// Public Route Component (redirect to dashboard if already authenticated)
const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading, user } = useAuth();

  // Clear other tokens if trying to access regular login
  React.useEffect(() => {
    const marketerToken = localStorage.getItem('marketerToken');
    const promoCodeAdminToken = localStorage.getItem('promoCodeAdminToken');
    const superAdminToken = localStorage.getItem('superAdminToken');
    const platformStaffToken = localStorage.getItem('platformStaffToken');
    if (marketerToken || promoCodeAdminToken || superAdminToken || platformStaffToken) {
      // User is trying to access regular login but has other tokens
      // Clear it to prevent conflicts
      if (marketerToken) {
        localStorage.removeItem('marketerToken');
        localStorage.removeItem('marketer');
        localStorage.removeItem('marketerTenant');
        sessionStorage.setItem('marketerLoggedOut', 'true');
      }
      if (promoCodeAdminToken) {
        localStorage.removeItem('promoCodeAdminToken');
        localStorage.removeItem('promoCodeAdmin');
        localStorage.removeItem('promoCodeAdminTenant');
      }
      if (superAdminToken) {
        localStorage.removeItem('superAdminToken');
        localStorage.removeItem('superAdmin');
      }
      if (platformStaffToken) {
        localStorage.removeItem('platformStaffToken');
        localStorage.removeItem('platformStaff');
      }
    }
  }, []);

  if (isLoading) {
    return <PageLoader />;
  }

  return !isAuthenticated ? (
    <>{children}</>
  ) : (
    <Navigate to={user?.role === 'PROMOTER' ? '/clients' : '/dashboard'} replace />
  );
};

// Protected Marketer Route Component
const ProtectedMarketerRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useMarketerAuth();

  if (isLoading) {
    return <PageLoader />;
  }

  return isAuthenticated ? <>{children}</> : <Navigate to="/auth" replace />;
};

// Protected Promo Code Admin Route Component
const ProtectedPromoCodeAdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = usePromoCodeAdminAuth();

  if (isLoading) {
    return <PageLoader />;
  }

  return isAuthenticated ? <>{children}</> : <Navigate to="/auth" replace />;
};

// Protected Super Admin Route Component
const ProtectedSuperAdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useSuperAdminAuth();

  if (isLoading) {
    return <PageLoader />;
  }

  return isAuthenticated ? <>{children}</> : <Navigate to="/auth" replace />;
};

const ProtectedTesterRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useTesterAuth();

  if (isLoading) {
    return <PageLoader />;
  }

  return isAuthenticated ? <>{children}</> : <Navigate to="/auth" replace />;
};

const ProtectedPlatformStaffRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = usePlatformStaffAuth();
  if (isLoading) return <PageLoader />;
  return isAuthenticated ? <>{children}</> : <Navigate to="/auth" replace />;
};

/**
 * Пока включено техобслуживание / тестирование — посторонние видят заглушку
 * (в обычном testing — /auth разрешён; в closed testing — нет).
 */
const MaintenanceGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const [checking, setChecking] = React.useState(true);
  const [blocked, setBlocked] = React.useState(
    () =>
      sessionStorage.getItem('maintenanceMode') === '1' ||
      sessionStorage.getItem('closedTestingMode') === '1' ||
      (sessionStorage.getItem('testingMode') === '1' &&
        sessionStorage.getItem('testingModeAccess') !== '1')
  );
  const [message, setMessage] = React.useState(
    'На сайте сейчас технические работы. Сервис временно недоступен. Попробуйте позже.'
  );
  const [mode, setMode] = React.useState<'maintenance' | 'testing' | 'closed_testing'>(() => {
    if (sessionStorage.getItem('closedTestingMode') === '1') return 'closed_testing';
    if (
      sessionStorage.getItem('testingMode') === '1' &&
      sessionStorage.getItem('maintenanceMode') !== '1'
    ) {
      return 'testing';
    }
    return 'maintenance';
  });
  const isSa = Boolean(localStorage.getItem('superAdminToken'));
  const hasResolvedMaintenanceOnceRef = React.useRef(false);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      // Не размонтируем дерево на каждый pathname — иначе сбрасывается обучение и т.п.
      if (!hasResolvedMaintenanceOnceRef.current) setChecking(true);
      try {
        const status = await apiService.getMaintenanceStatus();
        if (cancelled) return;

        const maintenanceOn = Boolean(status?.maintenance?.enabled ?? status?.enabled);
        const closedOn = Boolean(status?.closedTesting?.enabled);
        const testingOn = Boolean(status?.testing?.enabled);

        if (maintenanceOn) {
          sessionStorage.setItem('maintenanceMode', '1');
          sessionStorage.removeItem('testingMode');
          sessionStorage.removeItem('closedTestingMode');
          sessionStorage.removeItem('testingModeAccess');
          setMode('maintenance');
          setMessage(status?.maintenance?.message || status?.message || message);
          setBlocked(!isSa);
        } else if (closedOn) {
          sessionStorage.removeItem('maintenanceMode');
          sessionStorage.setItem('closedTestingMode', '1');
          sessionStorage.setItem('testingMode', '1');
          setMode('closed_testing');
          setMessage(status?.closedTesting?.message || message);
          // Гость без localStorage-сессии всегда на заглушке (cookie ≠ вход в SPA)
          if (isSa) {
            sessionStorage.setItem('testingModeAccess', '1');
            setBlocked(false);
          } else if (!hasAnySession()) {
            sessionStorage.removeItem('testingModeAccess');
            setBlocked(true);
          } else {
            try {
              const access = await apiService.getMaintenanceAccess();
              if (access?.canAccess) {
                sessionStorage.setItem('testingModeAccess', '1');
                setBlocked(false);
              } else {
                sessionStorage.removeItem('testingModeAccess');
                setBlocked(true);
              }
            } catch {
              sessionStorage.removeItem('testingModeAccess');
              setBlocked(true);
            }
          }
        } else if (testingOn) {
          sessionStorage.removeItem('maintenanceMode');
          sessionStorage.removeItem('closedTestingMode');
          sessionStorage.setItem('testingMode', '1');
          setMode('testing');
          setMessage(status?.testing?.message || message);
          if (isSa) {
            sessionStorage.setItem('testingModeAccess', '1');
            setBlocked(false);
          } else if (!hasAnySession()) {
            // Гость → заглушка (с кнопкой входа); /auth пропускается отдельно
            sessionStorage.removeItem('testingModeAccess');
            setBlocked(true);
          } else {
            try {
              const access = await apiService.getMaintenanceAccess();
              if (access?.canAccess) {
                sessionStorage.setItem('testingModeAccess', '1');
                setBlocked(false);
              } else {
                sessionStorage.removeItem('testingModeAccess');
                setBlocked(true);
              }
            } catch {
              sessionStorage.removeItem('testingModeAccess');
              setBlocked(true);
            }
          }
        } else {
          sessionStorage.removeItem('maintenanceMode');
          sessionStorage.removeItem('testingMode');
          sessionStorage.removeItem('closedTestingMode');
          sessionStorage.removeItem('testingModeAccess');
          setBlocked(false);
        }
      } catch {
        /* ignore — leave session flags */
      } finally {
        if (!cancelled) {
          hasResolvedMaintenanceOnceRef.current = true;
          setChecking(false);
        }
      }
    })();

    const onEvent = (e: Event) => {
      const detail = (e as CustomEvent).detail || {};
      const eventMode =
        detail.mode === 'closed_testing'
          ? 'closed_testing'
          : detail.mode === 'testing'
            ? 'testing'
            : 'maintenance';
      setMode(eventMode);
      if (detail.message) setMessage(String(detail.message));
      if (eventMode === 'closed_testing') {
        sessionStorage.setItem('closedTestingMode', '1');
        sessionStorage.setItem('testingMode', '1');
        sessionStorage.removeItem('testingModeAccess');
        sessionStorage.removeItem('maintenanceMode');
        setBlocked(true);
      } else if (eventMode === 'testing') {
        sessionStorage.setItem('testingMode', '1');
        sessionStorage.removeItem('closedTestingMode');
        sessionStorage.removeItem('testingModeAccess');
        if (!localStorage.getItem('superAdminToken')) setBlocked(true);
      } else {
        sessionStorage.setItem('maintenanceMode', '1');
        sessionStorage.removeItem('closedTestingMode');
        if (!localStorage.getItem('superAdminToken')) setBlocked(true);
      }
    };
    window.addEventListener('maintenance-mode', onEvent as EventListener);
    return () => {
      cancelled = true;
      window.removeEventListener('maintenance-mode', onEvent as EventListener);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSa, location.pathname]);

  // Соглашение и политика всегда можно открыть (API публичный)
  if (location.pathname === '/terms' || location.pathname === '/privacy') {
    return <>{children}</>;
  }

  if (checking && !blocked) {
    return <PageLoader />;
  }

  if (blocked && !isSa) {
    if (
      location.pathname === '/partner/register' ||
      location.pathname === '/marketer/register'
    ) {
      return <Navigate to={mode === 'closed_testing' ? '/maintenance' : '/auth'} replace />;
    }
    // В обычном testing /auth открыт; в closed testing — нет
    if (location.pathname === '/auth' && mode !== 'closed_testing') {
      return <>{children}</>;
    }
    return (
      <Suspense fallback={<PageLoader />}>
        <Maintenance message={message} mode={mode} />
      </Suspense>
    );
  }

  return <>{children}</>;
};

// Main App Component
const AppContent: React.FC = () => {
  const { user, isAuthenticated } = useAuth();
  const [onboardingOpen, setOnboardingOpen] = React.useState(false);
  const [onboardingLoading, setOnboardingLoading] = React.useState(true);
  const [onboardingKey, setOnboardingKey] = React.useState(0);

  // Сброс устаревшей тёмной темы — новый дизайн только светлый
  React.useEffect(() => {
    localStorage.removeItem('darkMode');
  }, []);

  const SCHOOL_ONBOARDING_ROLES = ['OWNER', 'ADMIN', 'TRAINER', 'PROMOTER'];

  // Check onboarding status when user is authenticated
  React.useEffect(() => {
    const checkOnboardingStatus = async () => {
      if (!isAuthenticated || !user || !SCHOOL_ONBOARDING_ROLES.includes(user.role)) {
        setOnboardingLoading(false);
        return;
      }

      try {
        const response = await apiService.getSettings();
        const settings = response.data;

        if (!settings?.hasCompletedOnboarding && !settings?.onboardingDeclined) {
          setOnboardingOpen(true);
        }
      } catch (error) {
        console.error('Error checking onboarding status:', error);
      } finally {
        setOnboardingLoading(false);
      }
    };

    checkOnboardingStatus();
  }, [isAuthenticated, user?.id, user?.role]);

  // Listen for restart onboarding event
  React.useEffect(() => {
    const handleRestartOnboarding = () => {
      if (!isAuthenticated || !user || !SCHOOL_ONBOARDING_ROLES.includes(user.role)) {
        return;
      }
      setOnboardingKey((k) => k + 1);
      setOnboardingOpen(true);
    };

    window.addEventListener('restartOnboarding', handleRestartOnboarding as EventListener);
    return () => {
      window.removeEventListener('restartOnboarding', handleRestartOnboarding as EventListener);
    };
  }, [isAuthenticated, user?.id, user?.role]);

  const handleOnboardingComplete = () => {
    setOnboardingOpen(false);
  };

  const handleOnboardingDecline = () => {
    setOnboardingOpen(false);
  };

  return (
    <ThemeProvider theme={appTheme}>
      <CssBaseline />
    <Router>
      <MaintenanceGate>
      <SiteTrafficTracker />
      <CookieConsentBanner />
      <SupportFAB />
      <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/maintenance" element={<Maintenance />} />
        {/* Unified auth — единый вход для всех ролей (Figma) */}
        <Route path="/auth" element={<Auth />} />
        <Route path="/login" element={<Navigate to="/auth" replace />} />
        <Route path="/client/login" element={<Navigate to="/auth" replace />} />
        <Route path="/reset-password" element={<Navigate to="/auth" replace />} />
        <Route
          path="/register"
          element={
            <PublicRoute>
              <Register />
            </PublicRoute>
          }
        />
        <Route
          path="/client/register"
          element={<ClientRegister />}
        />
        <Route
          path="/parent/register"
          element={<ParentRegister />}
        />
        <Route
          path="/partner/register"
          element={<PartnerRegister />}
        />
        <Route
          path="/client/dashboard"
          element={<ClientDashboard />}
        />
          {/* Public routes - accessible for both authenticated and non-authenticated users */}
          <Route
            path="/faq"
            element={<FAQWrapper />}
          />
          <Route
            path="/terms"
            element={<TermsOfServiceWrapper />}
          />
          <Route
            path="/privacy"
            element={<PrivacyPolicyWrapper />}
          />
          <Route
            path="/contacts"
            element={<ContactsWrapper />}
          />
          <Route
            path="/pricing"
            element={<PricingWrapper />}
          />

        {/* Protected Routes */}
        <Route
          path="/dashboard"
          element={
            <RoleRoute roles={['OWNER', 'ADMIN', 'TRAINER']}>
              <AppLayout>
                <Dashboard />
              </AppLayout>
            </RoleRoute>
          }
        />
        <Route
          path="/clients"
          element={
            <RoleRoute roles={['OWNER', 'ADMIN', 'TRAINER', 'PROMOTER']}>
              <AppLayout>
                <Clients />
              </AppLayout>
            </RoleRoute>
          }
        />
        <Route
          path="/trainers"
          element={
            <RoleRoute roles={['OWNER', 'ADMIN']}>
              <AppLayout>
                <Trainers />
              </AppLayout>
            </RoleRoute>
          }
        />
        <Route
          path="/trainer/profile"
          element={
            <RoleRoute roles={['TRAINER']}>
              <AppLayout>
                <TrainerProfile />
              </AppLayout>
            </RoleRoute>
          }
        />
        <Route
          path="/trainer/earnings"
          element={
            <ProtectedRoute>
              <AppLayout>
                <TrainerEarnings />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/trainers/earnings"
          element={
            <RoleRoute roles={['OWNER', 'ADMIN']}>
              <AppLayout>
                <AllTrainersEarnings />
              </AppLayout>
            </RoleRoute>
          }
        />
        <Route
          path="/groups"
          element={
            <ProtectedRoute>
              <AppLayout>
                <Groups />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route path="/branches" element={<Navigate to="/groups" replace />} />
        <Route
          path="/schedule"
          element={
            <ProtectedRoute>
              <AppLayout>
                <Schedule />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/chats"
          element={
            <ProtectedRoute>
              <AppLayout pageTitle="Чаты">
                <Chats />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/staff-workspace"
          element={
            <ProtectedRoute>
              <AppLayout pageTitle="Заметки и задачи">
                <StaffWorkspace />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/training-plan"
          element={
            <RoleRoute roles={['OWNER', 'TRAINER']}>
              <AppLayout pageTitle="Тренировочный план">
                <TrainingPlan />
              </AppLayout>
            </RoleRoute>
          }
        />
        <Route
          path="/competitions"
          element={<Navigate to="/schedule?tab=competitions" replace />}
        />
        <Route
          path="/finance"
          element={
            <RoleRoute roles={['OWNER', 'ADMIN']}>
              <AppLayout>
                <Finance />
              </AppLayout>
            </RoleRoute>
          }
        />
        <Route path="/payments" element={<Navigate to="/finance" replace />} />
        <Route
          path="/memberships"
          element={
            <RoleRoute roles={['OWNER', 'ADMIN']}>
              <AppLayout>
                <Memberships />
              </AppLayout>
            </RoleRoute>
          }
        />
        <Route path="/client-memberships" element={<Navigate to="/memberships" replace />} />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <AppLayout>
                <Settings />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/knowledge-base"
          element={
            <ProtectedRoute>
              <AppLayout>
                <KnowledgeBase />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route path="/super-admin/login" element={<Navigate to="/auth" replace />} />
        <Route
          path="/admin/dashboard"
          element={
            <ProtectedSuperAdminRoute>
              <AppLayout>
                <AdminDashboard />
              </AppLayout>
            </ProtectedSuperAdminRoute>
          }
        />
        <Route
          path="/admin/support-hub"
          element={
            <ProtectedSuperAdminRoute>
              <AppLayout>
                <SuperAdminSupportHub />
              </AppLayout>
            </ProtectedSuperAdminRoute>
          }
        />
        <Route
          path="/tester/dashboard"
          element={
            <ProtectedTesterRoute>
              <AppLayout pageTitle="Панель тестировщика">
                <TesterDashboard />
              </AppLayout>
            </ProtectedTesterRoute>
          }
        />
        <Route path="/platform-staff/login" element={<Navigate to="/auth" replace />} />
        <Route
          path="/platform-staff/desk"
          element={
            <ProtectedPlatformStaffRoute>
              <PlatformStaffDesk />
            </ProtectedPlatformStaffRoute>
          }
        />
        <Route
          path="/platform-staff/change-password"
          element={
            <ProtectedPlatformStaffRoute>
              <PlatformStaffChangePassword />
            </ProtectedPlatformStaffRoute>
          }
        />
        <Route path="/marketer/login" element={<Navigate to="/auth" replace />} />
        <Route path="/marketer/register" element={<MarketerRegister />} />
        <Route path="/marketer/panel" element={<Navigate to="/marketer/dashboard" replace />} />
        <Route
          path="/marketer/dashboard"
          element={
            <ProtectedMarketerRoute>
              <AppLayout>
                <MarketerDashboard />
              </AppLayout>
            </ProtectedMarketerRoute>
          }
        />
        <Route
          path="/marketer/clients"
          element={
            <ProtectedMarketerRoute>
              <AppLayout>
                <MarketerClients />
              </AppLayout>
            </ProtectedMarketerRoute>
          }
        />
        <Route
          path="/marketer/clients/:id"
          element={
            <ProtectedMarketerRoute>
              <AppLayout>
                <MarketerClientCard />
              </AppLayout>
            </ProtectedMarketerRoute>
          }
        />
        <Route
          path="/marketer/tasks"
          element={
            <ProtectedMarketerRoute>
              <AppLayout>
                <MarketerTasks />
              </AppLayout>
            </ProtectedMarketerRoute>
          }
        />
        <Route
          path="/marketer/calendar"
          element={
            <ProtectedMarketerRoute>
              <AppLayout>
                <MarketerCalendar />
              </AppLayout>
            </ProtectedMarketerRoute>
          }
        />
        <Route
          path="/marketer/chats"
          element={
            <ProtectedMarketerRoute>
              <AppLayout>
                <MarketerChats />
              </AppLayout>
            </ProtectedMarketerRoute>
          }
        />
        <Route
          path="/marketer/finance"
          element={
            <ProtectedMarketerRoute>
              <AppLayout>
                <MarketerFinance />
              </AppLayout>
            </ProtectedMarketerRoute>
          }
        />
        <Route
          path="/marketer/ads"
          element={
            <ProtectedMarketerRoute>
              <AppLayout>
                <MarketerAds />
              </AppLayout>
            </ProtectedMarketerRoute>
          }
        />
        <Route path="/ref/:code" element={<ReferralLanding />} />
        <Route path="/promo-code-admin/login" element={<Navigate to="/auth" replace />} />
        <Route
          path="/admin/promo-codes"
          element={
            <ProtectedPromoCodeAdminRoute>
              <AppLayout>
                <AdminPromoCodes />
              </AppLayout>
            </ProtectedPromoCodeAdminRoute>
          }
        />
        <Route
          path="/subscription/success"
          element={
            <ProtectedRoute>
              <SubscriptionSuccess />
            </ProtectedRoute>
          }
        />

        <Route path="/" element={<HomeRoute />} />

        {/* Catch all route */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>
      </MaintenanceGate>
      {!onboardingLoading && user && SCHOOL_ONBOARDING_ROLES.includes(user.role) && (
        <InteractiveOnboarding
          key={`onboarding-${user.id}-${onboardingKey}`}
          open={onboardingOpen}
          onClose={handleOnboardingDecline}
          onComplete={handleOnboardingComplete}
          onDecline={handleOnboardingDecline}
        />
      )}
    </Router>
    </ThemeProvider>
  );
};

// Root App Component with Theme and Auth Providers
const App: React.FC = () => {
  return (
      <AuthProvider>
        <MarketerAuthProvider>
          <PromoCodeAdminAuthProvider>
          <SuperAdminAuthProvider>
            <TesterAuthProvider>
            <PlatformStaffAuthProvider>
              <AppContent />
            </PlatformStaffAuthProvider>
            </TesterAuthProvider>
          </SuperAdminAuthProvider>
          </PromoCodeAdminAuthProvider>
        </MarketerAuthProvider>
      </AuthProvider>
  );
};

export default App;
