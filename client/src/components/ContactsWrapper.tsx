import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import AppLayout from './Layout/AppLayout';
import Contacts from '../pages/Contacts';

/**
 * Wrapper component for Contacts that shows it in AppLayout for authenticated users
 * and without AppLayout for non-authenticated users
 */
const ContactsWrapper: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return null; // Will be handled by Suspense
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

