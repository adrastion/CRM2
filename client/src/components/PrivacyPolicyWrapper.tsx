import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import AppLayout from './Layout/AppLayout';
import PrivacyPolicy from '../pages/PrivacyPolicy';

/**
 * Политика: в AppLayout для авторизованных, без оболочки для гостей.
 */
const PrivacyPolicyWrapper: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return null;
  }

  const accessBlocked =
    sessionStorage.getItem('maintenanceMode') === '1' ||
    (sessionStorage.getItem('testingMode') === '1' &&
      sessionStorage.getItem('testingModeAccess') !== '1' &&
      !localStorage.getItem('superAdminToken'));

  if (isAuthenticated && !accessBlocked) {
    return (
      <AppLayout>
        <PrivacyPolicy />
      </AppLayout>
    );
  }

  return <PrivacyPolicy />;
};

export default PrivacyPolicyWrapper;
