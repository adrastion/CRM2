import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import AppLayout from './Layout/AppLayout';
import Pricing from '../pages/Pricing';

/**
 * Wrapper component for Pricing that shows it in AppLayout for authenticated users
 * and without AppLayout for non-authenticated users
 */
const PricingWrapper: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return null; // Will be handled by Suspense
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

