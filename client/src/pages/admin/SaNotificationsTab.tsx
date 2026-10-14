import React from 'react';
import { Box, Typography } from '@mui/material';
import NotificationSettingsPanel from '../../components/notifications/NotificationSettingsPanel';
import SchoolOffersPanel from '../../components/notifications/SchoolOffersPanel';

const SaNotificationsTab: React.FC = () => (
  <Box sx={{ maxWidth: 720 }}>
    <Typography variant="h5" gutterBottom>
      Уведомления
    </Typography>
    <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
      Чаты и публикации в «Новости». Алерты нагрузки сервера настраиваются во вкладке «Мониторинг».
    </Typography>
    <NotificationSettingsPanel actor="superAdmin" showChangelog />
    <SchoolOffersPanel />
  </Box>
);

export default SaNotificationsTab;
