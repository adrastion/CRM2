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
const AllTrainersEarnings = lazy(() => import('./pages/AllTrainersEarnings'));
const Groups = lazy(() => import('./pages/Groups'));
const Branches = lazy(() => import('./pages/Branches'));
const Schedule = lazy(() => import('./pages/Schedule'));
const Finance = lazy(() => import('./pages/Finance'));
const Memberships = lazy(() => import('./pages/Memberships'));
const FAQWrapper = lazy(() => import('./components/FAQWrapper'));
const KnowledgeBase = lazy(() => import('./pages/KnowledgeBase'));
const Maintenance = lazy(() => import('./pages/Maintenance'));
const TermsOfServiceWrapper = lazy(() => import('./components/TermsOfServiceWrapper'));
const ContactsWrapper = lazy(() => import('./components/ContactsWrapper'));
const PricingWrapper = lazy(() => import('./components/PricingWrapper'));
const SubscriptionSuccess = lazy(() => import('./pages/SubscriptionSuccess'));
const AdminPromoCodes = lazy(() => import('./pages/AdminPromoCodes'));
const MarketerPanel = lazy(() => import('./pages/MarketerPanel'));
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
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

/** Корень сайта: гости → лендинг, авторизованные → свой кабинет. */
const HomeRoute: React.FC = () => {
  if (hasAnySession()) {
    const dest = currentSessionDestination();
    return <Navigate to={dest || '/dashboard'} replace />;
  }
  return <Landing />;
};

// Public Route Component (redirect to dashboard if already authenticated)
const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

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

  return !isAuthenticated ? <>{children}</> : <Navigate to="/dashboard" replace />;
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
 * Пока включено техобслуживание — не-SA видят заглушку (кроме /auth для входа SA).
 */
const MaintenanceGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const [checking, setChecking] = React.useState(true);
  const [enabled, setEnabled] = React.useState(
    () => sessionStorage.getItem('maintenanceMode') === '1'
  );
  const [message, setMessage] = React.useState(
    'На сайте сейчас технические работы. Сервис временно недоступен. Попробуйте позже.'
  );
  const isSa = Boolean(localStorage.getItem('superAdminToken'));

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const status = await apiService.getMaintenanceStatus();
        if (cancelled) return;
        setEnabled(Boolean(status?.enabled));
        if (status?.message) setMessage(status.message);
        if (status?.enabled) sessionStorage.setItem('maintenanceMode', '1');
        else sessionStorage.removeItem('maintenanceMode');
      } catch {
        /* ignore — leave session flag */
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();

    const onEvent = (e: Event) => {
      const detail = (e as CustomEvent).detail || {};
      setEnabled(true);
      if (detail.message) setMessage(String(detail.message));
      sessionStorage.setItem('maintenanceMode', '1');
    };
    window.addEventListener('maintenance-mode', onEvent as EventListener);
    return () => {
      cancelled = true;
      window.removeEventListener('maintenance-mode', onEvent as EventListener);
    };
  }, []);

  if (checking && !enabled) {
    return <PageLoader />;
  }

  if (enabled && !isSa) {
    if (location.pathname === '/auth') {
      return <>{children}</>;
    }
    return (
      <Suspense fallback={<PageLoader />}>
        <Maintenance message={message} />
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

  // Сброс устаревшей тёмной темы — новый дизайн только светлый
  React.useEffect(() => {
    localStorage.removeItem('darkMode');
  }, []);

  // Check onboarding status when user is authenticated
  React.useEffect(() => {
    const checkOnboardingStatus = async () => {
      if (!isAuthenticated || !user || user.role !== 'OWNER') {
        setOnboardingLoading(false);
        return;
      }

      try {
        const response = await apiService.getSettings();
        const settings = response.data;
        
        // Show onboarding only if user hasn't completed it and hasn't declined
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
  }, [isAuthenticated, user]);

  // Listen for restart onboarding event
  React.useEffect(() => {
    const handleRestartOnboarding = async () => {
      if (!isAuthenticated || !user || user.role !== 'OWNER') {
        return;
      }

      try {
        // Проверяем статус обучения после сброса
        const response = await apiService.getSettings();
        const settings = response.data;
        
        if (!settings?.hasCompletedOnboarding && !settings?.onboardingDeclined) {
          setOnboardingOpen(true);
        }
      } catch (error) {
        console.error('Error checking onboarding status:', error);
      }
    };

    window.addEventListener('restartOnboarding', handleRestartOnboarding as EventListener);
    return () => {
      window.removeEventListener('restartOnboarding', handleRestartOnboarding as EventListener);
    };
  }, [isAuthenticated, user]);

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
      <SupportFAB />
      {!onboardingLoading && user?.role === 'OWNER' && (
        <InteractiveOnboarding
          open={onboardingOpen}
          onClose={handleOnboardingDecline}
          onComplete={handleOnboardingComplete}
          onDecline={handleOnboardingDecline}
        />
      )}
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
            <ProtectedRoute>
              <AppLayout>
                <Dashboard />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/clients"
          element={
            <ProtectedRoute>
              <AppLayout>
                <Clients />
              </AppLayout>
            </ProtectedRoute>
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
        <Route
          path="/branches"
          element={
            <RoleRoute roles={['OWNER', 'ADMIN']}>
              <AppLayout>
                <Branches />
              </AppLayout>
            </RoleRoute>
          }
        />
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
          path="/marketer/panel"
          element={
            <ProtectedMarketerRoute>
              <AppLayout>
                <MarketerPanel />
              </AppLayout>
            </ProtectedMarketerRoute>
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
