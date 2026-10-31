import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import AppLayout from './Layout/AppLayout';
import TermsOfService from '../pages/TermsOfService';
import PageLoader from './PageLoader';

/**
 * Wrapper component for Terms of Service that shows it in AppLayout for authenticated users
 * and without AppLayout for non-authenticated users
 */
const TermsOfServiceWrapper: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <PageLoader />;
  }

  const accessBlocked =
    sessionStorage.getItem('maintenanceMode') === '1' ||
    sessionStorage.getItem('closedTestingMode') === '1' ||
    (sessionStorage.getItem('testingMode') === '1' &&
      sessionStorage.getItem('testingModeAccess') !== '1' &&
      !localStorage.getItem('superAdminToken'));

  // При блокировке не открываем AppLayout — его API снова кидают на /maintenance
  if (isAuthenticated && !accessBlocked) {
    return (
      <AppLayout>
        <TermsOfService />
      </AppLayout>
    );
  }

  return <TermsOfService />;
};

export default TermsOfServiceWrapper;

