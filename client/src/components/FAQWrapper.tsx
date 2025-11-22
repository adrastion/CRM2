import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import AppLayout from './Layout/AppLayout';
import FAQ from '../pages/FAQ';

/**
 * Wrapper component for FAQ that shows it in AppLayout for authenticated users
 * and without AppLayout for non-authenticated users
 */
const FAQWrapper: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return null; // Will be handled by Suspense
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

