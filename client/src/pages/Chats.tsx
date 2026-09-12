import React from 'react';
import { Box } from '@mui/material';
import { useSearchParams } from 'react-router-dom';
import ChatWorkspace from '../components/chat/ChatWorkspace';
import { useAuth } from '../contexts/AuthContext';

/**
 * Страница чатов для OWNER / ADMIN / TRAINER.
 * Заголовок «Чаты» — только в AppLayout pageTitle.
 */
const Chats: React.FC = () => {
  const { user } = useAuth();
  const token = localStorage.getItem('token');
  const [params] = useSearchParams();
  const initialThreadId = params.get('threadId');

  if (!user) {
    return (
      <Box p={3}>
        Требуется вход
      </Box>
    );
  }

  return (
    <ChatWorkspace
      mode="staff"
      socketToken={token}
      self={{ kind: 'USER', id: user.id }}
      initialThreadId={initialThreadId}
    />
  );
};

export default Chats;
