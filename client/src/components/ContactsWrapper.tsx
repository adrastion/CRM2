import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import AppLayout from './Layout/AppLayout';
import Contacts from '../pages/Contacts';
import PageLoader from './PageLoader';

/**
 * Wrapper component for Contacts that shows it in AppLayout for authenticated users
 * and without AppLayout for non-authenticated users
 */
const ContactsWrapper: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <PageLoader />;
  }

  if (isAuthenticated) {
    return (
      <AppLayout>
        <Contacts />
      </AppLayout>
    );
  }

  return <Contacts />;
};

export default ContactsWrapper;

