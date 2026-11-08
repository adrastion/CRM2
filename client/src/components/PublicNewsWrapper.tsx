import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import AppLayout from './Layout/AppLayout';
import News from '../pages/News';
import PublicNews from '../pages/PublicNews';
import PageLoader from './PageLoader';

const SCHOOL_NEWS_ROLES = new Set(['OWNER', 'ADMIN', 'TRAINER', 'PROMOTER']);

/**
 * /news: сотрудники школы — лента ЛК; гости и остальные — публичные новости сайта.
 */
const PublicNewsWrapper: React.FC = () => {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return <PageLoader />;
  }

  if (isAuthenticated && user?.role && SCHOOL_NEWS_ROLES.has(user.role)) {
    return (
      <AppLayout>
        <News />
      </AppLayout>
    );
  }

  return <PublicNews />;
};

export default PublicNewsWrapper;
