import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  IconButton,
  Slide,
  useTheme,
} from '@mui/material';
import {
  Close as CloseIcon,
  Telegram as TelegramIcon,
} from '@mui/icons-material';
import { useTelegramBanner } from '../contexts/TelegramBannerContext';

const TELEGRAM_CHANNEL_URL = 'https://t.me/profsportcrm';
const STORAGE_KEY = 'telegramBannerShown';
const STORAGE_EXPIRY_DAYS = 1; // Показывать не чаще раза в день

const TelegramBanner: React.FC = () => {
  const [show, setShow] = useState(false);
  const { setBannerVisible } = useTelegramBanner();
  const theme = useTheme();

  useEffect(() => {
    // Проверяем, нужно ли показывать баннер
    const shouldShow = checkShouldShowBanner();
    if (shouldShow) {
      setShow(true);
      setBannerVisible(true);
      // Сохраняем время показа
      localStorage.setItem(STORAGE_KEY, new Date().toISOString());
    }
  }, [setBannerVisible]);

  const checkShouldShowBanner = (): boolean => {
    // Проверяем вероятность 25%
    const random = Math.random();
    if (random > 0.25) {
      return false;
    }

    // Проверяем, не показывали ли мы баннер недавно
    const lastShown = localStorage.getItem(STORAGE_KEY);
    if (!lastShown) {
      return true;
    }

    const lastShownDate = new Date(lastShown);
    const now = new Date();
    const daysDiff = (now.getTime() - lastShownDate.getTime()) / (1000 * 60 * 60 * 24);

    // Показываем, если прошло больше STORAGE_EXPIRY_DAYS дней
    return daysDiff >= STORAGE_EXPIRY_DAYS;
  };

  const handleClose = () => {
    setShow(false);
    setBannerVisible(false);
  };

  const handleSubscribe = () => {
    window.open(TELEGRAM_CHANNEL_URL, '_blank', 'noopener,noreferrer');
    setShow(false);
    setBannerVisible(false);
  };

  if (!show) {
    return null;
  }

  return (
    <Slide direction="down" in={show} mountOnEnter unmountOnExit>
      <Paper
        elevation={6}
        sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 1300,
          background: theme.palette.mode === 'dark'
            ? 'linear-gradient(135deg, #1e88e5 0%, #1565c0 100%)'
            : 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)',
          color: 'white',
          borderRadius: 0,
          px: { xs: 2, sm: 3 },
          py: 2,
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            maxWidth: 1200,
            margin: '0 auto',
            gap: 2,
          }}
        >
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              flex: 1,
            }}
          >
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: { xs: 40, sm: 48 },
                height: { xs: 40, sm: 48 },
                borderRadius: '50%',
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                flexShrink: 0,
              }}
            >
              <TelegramIcon sx={{ fontSize: { xs: 24, sm: 28 }, color: 'white' }} />
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography
                variant="h6"
                sx={{
                  fontSize: { xs: '0.95rem', sm: '1.1rem' },
                  fontWeight: 600,
                  mb: 0.5,
                  lineHeight: 1.2,
                }}
              >
                Подпишитесь на наш новостной Telegram-канал
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  fontSize: { xs: '0.8rem', sm: '0.9rem' },
                  opacity: 0.9,
                  lineHeight: 1.3,
                }}
              >
                Будьте в курсе всех обновлений и новостей системы
              </Typography>
            </Box>
          </Box>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              flexShrink: 0,
            }}
          >
            <Button
              variant="contained"
              onClick={handleSubscribe}
              sx={{
                backgroundColor: 'white',
                color: theme.palette.primary.main,
                fontWeight: 600,
                textTransform: 'none',
                px: { xs: 2, sm: 3 },
                py: { xs: 0.75, sm: 1 },
                fontSize: { xs: '0.85rem', sm: '0.95rem' },
                '&:hover': {
                  backgroundColor: 'rgba(255, 255, 255, 0.9)',
                },
                boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
              }}
              startIcon={<TelegramIcon />}
            >
              Подписаться
            </Button>
            <IconButton
              onClick={handleClose}
              sx={{
                color: 'white',
                '&:hover': {
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                },
              }}
              size="small"
            >
              <CloseIcon />
            </IconButton>
          </Box>
        </Box>
      </Paper>
    </Slide>
  );
};

export default TelegramBanner;

