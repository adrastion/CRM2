import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import AppLayout from './Layout/AppLayout';
import Pricing from '../pages/Pricing';
import PageLoader from './PageLoader';

/**
 * Wrapper component for Pricing that shows it in AppLayout for authenticated users
 * and without AppLayout for non-authenticated users
 */
const PricingWrapper: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <PageLoader />;
  }

  if (isAuthenticated) {
    return (
      <AppLayout>
        <Pricing />
      </AppLayout>
    );
  }

  return <Pricing />;
};

export default PricingWrapper;

