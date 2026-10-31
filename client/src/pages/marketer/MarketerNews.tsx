import React, { useCallback } from 'react';
import { Box, Typography } from '@mui/material';
import PlatformNewsFeed from '../../components/PlatformNewsFeed';
import { apiService } from '../../services/api';

/** Новости платформы в кабинете маркетолога (публикует SA с аудиторией MARKETER). */
const MarketerNews: React.FC = () => {
  const loadEntries = useCallback(() => apiService.listMarketerPlatformNews(), []);

  return (
    <Box>
      <Typography variant="h5" fontWeight={800} sx={{ mb: 0.5, color: '#13213a' }}>
        Новости
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
        Обновления и анонсы от платформы
      </Typography>
      <PlatformNewsFeed
        loadEntries={loadEntries}
        source="marketer"
        emptyText="Нет новостей для маркетологов"
      />
    </Box>
  );
};

export default MarketerNews;
