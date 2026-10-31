import React from 'react';
import { Box, Button, Typography } from '@mui/material';

type Props = { children: React.ReactNode };
type State = { hasError: boolean; message: string };

/**
 * Ловит падения дерева (в т.ч. после неудачного lazy-import) —
 * вместо вечного белого экрана на мобильных.
 */
class AppErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      message: error?.message || 'Неизвестная ошибка',
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[AppErrorBoundary]', error, info?.componentStack);
  }

  private reload = () => {
    try {
      sessionStorage.removeItem('crm2_chunk_reload');
    } catch {
      /* ignore */
    }
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <Box
        minHeight="100vh"
        display="flex"
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        px={3}
        textAlign="center"
        bgcolor="#F5F6FA"
      >
        <Typography variant="h6" sx={{ fontWeight: 800, mb: 1, color: '#13213a' }}>
          Не удалось загрузить страницу
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5, maxWidth: 420 }}>
          Часто это бывает после обновления сайта или при нестабильной сети. Обновите страницу —
          обычно этого достаточно.
        </Typography>
        <Button variant="contained" onClick={this.reload} sx={{ textTransform: 'none', fontWeight: 700 }}>
          Обновить
        </Button>
      </Box>
    );
  }
}

export default AppErrorBoundary;
