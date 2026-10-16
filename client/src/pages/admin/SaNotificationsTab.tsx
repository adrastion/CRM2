import React, { useEffect, useState } from 'react';
import { Box, Button, List, ListItem, ListItemText, Typography } from '@mui/material';
import NotificationSettingsPanel from '../../components/notifications/NotificationSettingsPanel';
import SchoolOffersPanel from '../../components/notifications/SchoolOffersPanel';
import Email2faSettingsToggle from '../../components/auth/Email2faSettingsToggle';
import { apiService } from '../../services/api';

const SaNotificationsTab: React.FC = () => {
  const [items, setItems] = useState<any[]>([]);

  const load = async () => {
    const rows = await apiService.getSaNotifications();
    setItems(rows);
  };

  useEffect(() => {
    load();
  }, []);

  const unread = items.filter((n) => !n.readAt).length;

  return (
    <Box sx={{ maxWidth: 720 }}>
      <Typography variant="h5" gutterBottom>
        Уведомления
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Заметки разработки и обсуждения. Непрочитанных: {unread}.
      </Typography>
      {unread > 0 && (
        <Button
          size="small"
          sx={{ mb: 2 }}
          onClick={async () => {
            await apiService.markSaNotificationsRead();
            await load();
          }}
        >
          Отметить прочитанными
        </Button>
      )}
      <List dense sx={{ mb: 3 }}>
        {items.map((n) => (
          <ListItem key={n.id} sx={{ bgcolor: n.readAt ? 'transparent' : 'action.hover', borderRadius: 1 }}>
            <ListItemText
              primary={n.title}
              secondary={`${n.body} · ${new Date(n.createdAt).toLocaleString('ru-RU')}`}
            />
          </ListItem>
        ))}
        {!items.length && <Typography variant="body2">Новых уведомлений нет</Typography>}
      </List>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Чаты и публикации в «Новости». Алерты нагрузки сервера настраиваются во вкладке «Мониторинг».
      </Typography>
      <Box sx={{ mb: 3 }}>
        <Email2faSettingsToggle />
      </Box>
      <NotificationSettingsPanel actor="superAdmin" showChangelog />
      <SchoolOffersPanel />
    </Box>
  );
};

export default SaNotificationsTab;
