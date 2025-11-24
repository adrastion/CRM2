import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import AppLayout from './Layout/AppLayout';
import TermsOfService from '../pages/TermsOfService';

/**
 * Wrapper component for Terms of Service that shows it in AppLayout for authenticated users
 * and without AppLayout for non-authenticated users
 */
const TermsOfServiceWrapper: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return null; // Will be handled by Suspense
  }

  if (isAuthenticated) {
    return (
      <AppLayout>
        <TermsOfService />
      </AppLayout>
    );
  }

  return <TermsOfService />;
};

export default TermsOfServiceWrapper;

