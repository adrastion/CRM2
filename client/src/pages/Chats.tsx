import React from 'react';
import { Box } from '@mui/material';
import ChatWorkspace from '../components/chat/ChatWorkspace';
import { useAuth } from '../contexts/AuthContext';

/**
 * Страница чатов для OWNER / ADMIN / TRAINER.
 * Заголовок «Чаты» — только в AppLayout pageTitle.
 */
const Chats: React.FC = () => {
  const { user } = useAuth();
  const token = localStorage.getItem('token');

  if (!user) {
    return (
      <Box p={3}>
        Требуется вход
      </Box>
    );
  }

  return (
    <ChatWorkspace mode="staff" socketToken={token} self={{ kind: 'USER', id: user.id }} />
  );
};

export default Chats;
