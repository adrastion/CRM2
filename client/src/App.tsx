import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { CssBaseline, Box, CircularProgress } from '@mui/material';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { MarketerAuthProvider, useMarketerAuth } from './contexts/MarketerAuthContext';
import { PromoCodeAdminAuthProvider, usePromoCodeAdminAuth } from './contexts/PromoCodeAdminAuthContext';
import { SuperAdminAuthProvider, useSuperAdminAuth } from './contexts/SuperAdminAuthContext';
import AppLayout from './components/Layout/AppLayout';

// Lazy load pages for better performance
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Clients = lazy(() => import('./pages/Clients'));
const ClientCategories = lazy(() => import('./pages/ClientCategories'));
const Standards = lazy(() => import('./pages/Standards'));
const Trainers = lazy(() => import('./pages/Trainers'));
const TrainerEarnings = lazy(() => import('./pages/TrainerEarnings'));
const AllTrainersEarnings = lazy(() => import('./pages/AllTrainersEarnings'));
const Groups = lazy(() => import('./pages/Groups'));
const Branches = lazy(() => import('./pages/Branches'));
const Schedule = lazy(() => import('./pages/Schedule'));
const Payments = lazy(() => import('./pages/Payments'));
const Memberships = lazy(() => import('./pages/Memberships'));
const ClientMemberships = lazy(() => import('./pages/ClientMemberships'));
const FAQ = lazy(() => import('./pages/FAQ'));
const FAQWrapper = lazy(() => import('./components/FAQWrapper'));
const TermsOfServiceWrapper = lazy(() => import('./components/TermsOfServiceWrapper'));
const ContactsWrapper = lazy(() => import('./components/ContactsWrapper'));
const PricingWrapper = lazy(() => import('./components/PricingWrapper'));
const SubscriptionSuccess = lazy(() => import('./pages/SubscriptionSuccess'));
const AdminPromoCodes = lazy(() => import('./pages/AdminPromoCodes'));
const MarketerPanel = lazy(() => import('./pages/MarketerPanel'));
const MarketerLogin = lazy(() => import('./pages/MarketerLogin'));
const PromoCodeAdminLogin = lazy(() => import('./pages/PromoCodeAdminLogin'));
const Settings = lazy(() => import('./pages/Settings'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const SuperAdminLogin = lazy(() => import('./pages/SuperAdminLogin'));

// Create Material-UI theme
const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
        },
      },
    },
  },
});

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

  // Clear marketer tokens if trying to access regular routes
  React.useEffect(() => {
    const marketerToken = localStorage.getItem('marketerToken');
    const promoCodeAdminToken = localStorage.getItem('promoCodeAdminToken');
    if (marketerToken || promoCodeAdminToken) {
      // User is trying to access regular routes but has marketer/admin token
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
    }
  }, []);

  if (isLoading) {
    return <PageLoader />;
  }

  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
};

// Public Route Component (redirect to dashboard if already authenticated)
const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  // Clear marketer tokens if trying to access regular login
  React.useEffect(() => {
    const marketerToken = localStorage.getItem('marketerToken');
    const promoCodeAdminToken = localStorage.getItem('promoCodeAdminToken');
    if (marketerToken || promoCodeAdminToken) {
      // User is trying to access regular login but has marketer/admin token
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

  return isAuthenticated ? <>{children}</> : <Navigate to="/marketer/login" replace />;
};

// Protected Promo Code Admin Route Component
const ProtectedPromoCodeAdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = usePromoCodeAdminAuth();

  if (isLoading) {
    return <PageLoader />;
  }

  return isAuthenticated ? <>{children}</> : <Navigate to="/promo-code-admin/login" replace />;
};

// Public Marketer Login Route (redirect if already authenticated as marketer)
const MarketerLoginRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useMarketerAuth();

  if (isLoading) {
    return <PageLoader />;
  }

  // Check if user explicitly logged out
  const wasLoggedOut = sessionStorage.getItem('marketerLoggedOut');
  if (wasLoggedOut === 'true') {
    // Allow access to login page even if token exists
    return <>{children}</>;
  }

  return !isAuthenticated ? <>{children}</> : <Navigate to="/marketer/panel" replace />;
};

// Public Promo Code Admin Login Route (redirect if already authenticated)
const PromoCodeAdminLoginRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = usePromoCodeAdminAuth();

  if (isLoading) {
    return <PageLoader />;
  }

  return !isAuthenticated ? <>{children}</> : <Navigate to="/admin/promo-codes" replace />;
};

// Protected Super Admin Route Component
const ProtectedSuperAdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useSuperAdminAuth();

  if (isLoading) {
    return <PageLoader />;
  }

  return isAuthenticated ? <>{children}</> : <Navigate to="/super-admin/login" replace />;
};

// Public Super Admin Login Route (redirect if already authenticated)
const SuperAdminLoginRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useSuperAdminAuth();

  if (isLoading) {
    return <PageLoader />;
  }

  return !isAuthenticated ? <>{children}</> : <Navigate to="/admin/dashboard" replace />;
};

// Main App Component
const AppContent: React.FC = () => {
  return (
    <Router>
      <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Public Routes */}
        <Route
          path="/login"
          element={
            <PublicRoute>
              <Login />
            </PublicRoute>
          }
        />
        <Route
          path="/register"
          element={
            <PublicRoute>
              <Register />
            </PublicRoute>
          }
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
          path="/client-categories"
          element={
            <ProtectedRoute>
              <AppLayout>
                <ClientCategories />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/standards"
          element={
            <ProtectedRoute>
              <AppLayout>
                <Standards />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/trainers"
          element={
            <ProtectedRoute>
              <AppLayout>
                <Trainers />
              </AppLayout>
            </ProtectedRoute>
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
            <ProtectedRoute>
              <AppLayout>
                <AllTrainersEarnings />
              </AppLayout>
            </ProtectedRoute>
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
            <ProtectedRoute>
              <AppLayout>
                <Branches />
              </AppLayout>
            </ProtectedRoute>
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
          path="/payments"
          element={
            <ProtectedRoute>
              <AppLayout>
                <Payments />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/memberships"
          element={
            <ProtectedRoute>
              <AppLayout>
                <Memberships />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/client-memberships"
          element={
            <ProtectedRoute>
              <AppLayout>
                <ClientMemberships />
              </AppLayout>
            </ProtectedRoute>
          }
        />
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
          path="/super-admin/login"
          element={
            <SuperAdminLoginRoute>
              <SuperAdminLogin />
            </SuperAdminLoginRoute>
          }
        />
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
          path="/marketer/login"
          element={
            <MarketerLoginRoute>
              <MarketerLogin />
            </MarketerLoginRoute>
          }
        />
        <Route
          path="/promo-code-admin/login"
          element={
            <PromoCodeAdminLoginRoute>
              <PromoCodeAdminLogin />
            </PromoCodeAdminLoginRoute>
          }
        />
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

        {/* Default redirect */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        
        {/* Catch all route */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
      </Suspense>
    </Router>
  );
};

// Root App Component with Theme and Auth Providers
const App: React.FC = () => {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <MarketerAuthProvider>
          <PromoCodeAdminAuthProvider>
            <SuperAdminAuthProvider>
              <AppContent />
            </SuperAdminAuthProvider>
          </PromoCodeAdminAuthProvider>
        </MarketerAuthProvider>
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;
