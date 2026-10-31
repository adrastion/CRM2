import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import AppLayout from './Layout/AppLayout';
import FAQ from '../pages/FAQ';
import PageLoader from './PageLoader';

/**
 * Wrapper component for FAQ that shows it in AppLayout for authenticated users
 * and without AppLayout for non-authenticated users
 */
const FAQWrapper: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <PageLoader />;
  }

  if (isAuthenticated) {
    return (
      <AppLayout>
        <FAQ />
      </AppLayout>
    );
  }

  return <FAQ />;
};

export default FAQWrapper;

