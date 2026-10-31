import React from 'react';
import { Box, CircularProgress } from '@mui/material';
import { Navigate, useLocation } from 'react-router-dom';
import { useMarketerCabinetReady } from '../../hooks/useMarketerCabinetReady';

/**
 * Пускает на рабочие страницы кабинета только после заполнения
 * профиля и «Подключения к программе».
 */
const MarketerWorkspaceGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const { loading, complete, profileDone } = useMarketerCabinetReady(true);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py={8}>
        <CircularProgress />
      </Box>
    );
  }

  if (!complete) {
    const to = profileDone ? '/marketer/onboarding' : '/marketer/profile';
    return <Navigate to={to} replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
};

export default MarketerWorkspaceGate;
