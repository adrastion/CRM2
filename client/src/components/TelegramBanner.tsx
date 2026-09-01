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
  Support as SupportIcon,
} from '@mui/icons-material';
import { useTelegramBanner } from '../contexts/TelegramBannerContext';

const TELEGRAM_CHANNEL_URL = 'https://t.me/profsportcrm';
const TELEGRAM_SUPPORT_URL = 'https://t.me/profsportcrm_ts';
const STORAGE_KEY_NEWS = 'telegramBannerNewsShown';
const STORAGE_KEY_SUPPORT = 'telegramBannerSupportShown';
const STORAGE_EXPIRY_DAYS = 1; // Показывать не чаще раза в день

type BannerType = 'news' | 'support' | null;

const TelegramBanner: React.FC = () => {
  const [show, setShow] = useState(false);
  const [bannerType, setBannerType] = useState<BannerType>(null);
  const { setBannerVisible } = useTelegramBanner();
  const theme = useTheme();

  useEffect(() => {
    // Проверяем, нужно ли показывать баннер
    const result = checkShouldShowBanner();
    if (result.shouldShow && result.type) {
      setBannerType(result.type);
      setShow(true);
      setBannerVisible(true);
      // Сохраняем время показа для соответствующего типа плашки
      const storageKey = result.type === 'news' ? STORAGE_KEY_NEWS : STORAGE_KEY_SUPPORT;
      localStorage.setItem(storageKey, new Date().toISOString());
    }
  }, [setBannerVisible]);

  const checkShouldShowBanner = (): { shouldShow: boolean; type: BannerType } => {
    // Проверяем вероятность 25%
    const random = Math.random();
    if (random > 0.25) {
      return { shouldShow: false, type: null };
    }

    // Определяем, какую плашку показывать (50% вероятность для каждой)
    const bannerRandom = Math.random();
    const selectedType: BannerType = bannerRandom < 0.5 ? 'news' : 'support';
    const storageKey = selectedType === 'news' ? STORAGE_KEY_NEWS : STORAGE_KEY_SUPPORT;

    // Проверяем, не показывали ли мы эту плашку недавно
    const lastShown = localStorage.getItem(storageKey);
    if (!lastShown) {
      return { shouldShow: true, type: selectedType };
    }

    const lastShownDate = new Date(lastShown);
    const now = new Date();
    const daysDiff = (now.getTime() - lastShownDate.getTime()) / (1000 * 60 * 60 * 24);

    // Показываем, если прошло больше STORAGE_EXPIRY_DAYS дней
    if (daysDiff >= STORAGE_EXPIRY_DAYS) {
      return { shouldShow: true, type: selectedType };
    }

    // Если эта плашка показывалась недавно, пробуем другую
    const otherType: BannerType = selectedType === 'news' ? 'support' : 'news';
    const otherStorageKey = otherType === 'news' ? STORAGE_KEY_NEWS : STORAGE_KEY_SUPPORT;
    const otherLastShown = localStorage.getItem(otherStorageKey);
    
    if (!otherLastShown) {
      return { shouldShow: true, type: otherType };
    }

    const otherLastShownDate = new Date(otherLastShown);
    const otherDaysDiff = (now.getTime() - otherLastShownDate.getTime()) / (1000 * 60 * 60 * 24);

    if (otherDaysDiff >= STORAGE_EXPIRY_DAYS) {
      return { shouldShow: true, type: otherType };
    }

    return { shouldShow: false, type: null };
  };

  const handleClose = () => {
    setShow(false);
    setBannerVisible(false);
  };

  const handleAction = () => {
    const url = bannerType === 'news' ? TELEGRAM_CHANNEL_URL : TELEGRAM_SUPPORT_URL;
    window.open(url, '_blank', 'noopener,noreferrer');
    setShow(false);
    setBannerVisible(false);
  };

  if (!show || !bannerType) {
    return null;
  }

  const isNewsBanner = bannerType === 'news';
  const title = isNewsBanner 
    ? 'Подпишитесь на наш новостной Telegram-канал'
    : 'Есть вопросы? Нужна техническая поддержка?';
  const description = isNewsBanner
    ? 'Будьте в курсе всех обновлений и новостей системы'
    : 'Есть идеи как сделать удобнее? Напишите в нашу техническую поддержку';
  const buttonText = isNewsBanner ? 'Подписаться' : 'Написать в поддержку';
  const Icon = isNewsBanner ? TelegramIcon : SupportIcon;

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
          background: 'linear-gradient(135deg, #4880FF 0%, #0D4BD7 100%)',
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
              <Icon sx={{ fontSize: { xs: 24, sm: 28 }, color: 'white' }} />
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
                {title}
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  fontSize: { xs: '0.8rem', sm: '0.9rem' },
                  opacity: 0.9,
                  lineHeight: 1.3,
                }}
              >
                {description}
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
              onClick={handleAction}
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
              startIcon={<Icon />}
            >
              {buttonText}
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

