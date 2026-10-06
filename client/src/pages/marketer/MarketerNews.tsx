import React, { useCallback } from 'react';
import { Box } from '@mui/material';
import PlatformNewsFeed from '../../components/PlatformNewsFeed';
import { apiService } from '../../services/api';

/** Новости платформы в кабинете маркетолога. */
const MarketerNews: React.FC = () => {
  const loadEntries = useCallback(() => apiService.listMarketerPlatformNews(), []);

  return (
    <Box>
      <PlatformNewsFeed
        loadEntries={loadEntries}
        source="marketer"
        emptyText="Нет новостей для маркетологов"
      />
    </Box>
  );
};

export default MarketerNews;
