import React, { useCallback } from 'react';
import { Box } from '@mui/material';
import PlatformNewsFeed from '../components/PlatformNewsFeed';
import { apiService } from '../services/api';

/** Лента новостей платформы для сотрудников школы. */
const News: React.FC = () => {
  const loadEntries = useCallback(() => apiService.listPlatformNews(), []);

  return (
    <Box data-onboarding="news-page">
      <PlatformNewsFeed loadEntries={loadEntries} source="school" />
    </Box>
  );
};

export default News;
