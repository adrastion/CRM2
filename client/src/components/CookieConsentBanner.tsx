import React, { useEffect, useState } from 'react';
import { Box, Button, Link, Paper, Stack, Typography } from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  getCookieConsent,
  setCookieConsent,
} from '../utils/cookieConsent';
import { colors, typography } from '../theme/tokens';

/**
 * Баннер согласия на cookies / аналитику.
 * Скрыт на заглушке техобслуживания/тестирования, чтобы не перекрывать кнопки входа.
 */
const CookieConsentBanner: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [visible, setVisible] = useState(false);

  const onAccessStub =
    location.pathname === '/maintenance' ||
    (typeof sessionStorage !== 'undefined' &&
      ((sessionStorage.getItem('maintenanceMode') === '1' &&
        !localStorage.getItem('superAdminToken')) ||
        (sessionStorage.getItem('testingMode') === '1' &&
          sessionStorage.getItem('testingModeAccess') !== '1' &&
          !localStorage.getItem('superAdminToken'))));

  useEffect(() => {
    if (onAccessStub) {
      setVisible(false);
      return;
    }
    setVisible(getCookieConsent() === null);
  }, [onAccessStub]);

  if (!visible || onAccessStub) return null;

  const choose = (value: 'accepted' | 'essential') => {
    setCookieConsent(value);
    setVisible(false);
  };

  return (
    <Box
      sx={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1400,
        p: { xs: 1.5, sm: 2 },
        pointerEvents: 'none',
      }}
    >
      <Paper
        elevation={8}
        sx={{
          maxWidth: 720,
          mx: 'auto',
          p: 2,
          pointerEvents: 'auto',
          borderRadius: 2,
          bgcolor: colors.card,
        }}
      >
        <Typography sx={{ fontSize: typography.label, color: colors.text, mb: 1.5 }}>
          Мы используем необходимые cookies для работы сайта. Аналитика посещаемости включается
          только с вашего согласия.{' '}
          <Link
            component="button"
            type="button"
            onClick={() => navigate('/privacy')}
            sx={{ verticalAlign: 'baseline', cursor: 'pointer' }}
          >
            Подробнее
          </Link>
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="flex-end">
          <Button
            variant="outlined"
            size="small"
            sx={{ textTransform: 'none' }}
            onClick={() => choose('essential')}
          >
            Только необходимые
          </Button>
          <Button
            variant="contained"
            size="small"
            sx={{ textTransform: 'none' }}
            onClick={() => choose('accepted')}
          >
            Принять
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
};

export default CookieConsentBanner;
