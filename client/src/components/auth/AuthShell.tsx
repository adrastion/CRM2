import React from 'react';
import { Box, Button, Typography, useMediaQuery, useTheme } from '@mui/material';
import { ArrowBack } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import BrandLogo from '../common/BrandLogo';
import { colors, radii, sizes, typography } from '../../theme/tokens';

interface AuthShellProps {
  /** Крупный заголовок над карточкой. */
  title: string;
  /** Вторая строка заголовка (например, «Сотрудника»). */
  titleSecondLine?: string;
  /** Короткий подзаголовок под title. */
  subtitle?: string;
  /** Ширина карточки: узкая для входа, широкая для выбора организации/регистрации. */
  width?: 'auth' | 'select' | 'register' | 'full';
  /** Содержимое карточки. Если false — дети рисуются без карточки. */
  card?: boolean;
  /** Доп. блок внизу фирменной панели (desktop) — например вход по QR. */
  asideExtra?: React.ReactNode;
  /** Доп. блок под карточкой на мобиле (когда нет боковой панели). */
  belowCard?: React.ReactNode;
  children: React.ReactNode;
}

const WIDTHS: Record<NonNullable<AuthShellProps['width']>, number | string> = {
  auth: sizes.authCardWidth,
  select: sizes.selectCardWidth,
  register: sizes.registerCardWidth,
  full: '100%',
};

/**
 * Каркас авторизации/регистрации в стиле публичного сайта:
 * фирменная панель + светлая карточка, «Назад» на лендинг.
 */
const AuthShell: React.FC<AuthShellProps> = ({
  title,
  titleSecondLine,
  subtitle,
  width = 'auth',
  card = true,
  asideExtra,
  belowCard,
  children,
}) => {
  const navigate = useNavigate();
  const theme = useTheme();
  const isCompact = useMediaQuery(theme.breakpoints.down('md'));
  const showSidePanel = !isCompact && width !== 'register' && width !== 'full';

  const goBack = () => {
    if (
      sessionStorage.getItem('testingMode') === '1' ||
      sessionStorage.getItem('maintenanceMode') === '1'
    ) {
      navigate('/maintenance');
      return;
    }
    navigate('/');
  };

  const titleBlock = (
    <Box sx={{ width: '100%', textAlign: { xs: 'center', md: showSidePanel ? 'left' : 'center' }, mb: { xs: 0, md: 0.5 } }}>
      <Typography
        component="h1"
        sx={{
          color: colors.text,
          fontWeight: 800,
          lineHeight: 1.15,
          fontSize: typography.authTitle,
          letterSpacing: '-0.02em',
        }}
      >
        {title}
        {titleSecondLine && (
          <>
            <br />
            <Box component="span" sx={{ color: colors.primary }}>
              {titleSecondLine}
            </Box>
          </>
        )}
      </Typography>
      {subtitle && (
        <Typography sx={{ mt: 1.25, color: colors.textMuted, fontSize: { xs: 14, md: 15 }, lineHeight: 1.5, maxWidth: 420, mx: { xs: 'auto', md: showSidePanel ? 0 : 'auto' } }}>
          {subtitle}
        </Typography>
      )}
    </Box>
  );

  const cardInner = card ? (
    <Box
      sx={{
        width: '100%',
        bgcolor: colors.white,
        borderRadius: `${radii.card}px`,
        border: `1px solid ${colors.divider}`,
        boxShadow: '0 16px 48px rgba(13, 75, 215, 0.1)',
        px: { xs: 2, sm: 3, md: 3.5 },
        py: { xs: 2.5, md: 3.25 },
      }}
    >
      {children}
    </Box>
  ) : (
    <Box sx={{ width: '100%' }}>{children}</Box>
  );

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: '"Montserrat", sans-serif',
        background: `
          radial-gradient(ellipse 70% 50% at 10% 0%, rgba(47, 107, 255, 0.14) 0%, transparent 55%),
          linear-gradient(165deg, #F4F7FF 0%, ${colors.white} 42%, ${colors.surface} 100%)
        `,
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: { xs: 2, sm: 3, md: 4 },
          py: 1.5,
        }}
      >
        <Button
          startIcon={<ArrowBack />}
          onClick={goBack}
          sx={{ textTransform: 'none', color: colors.textMuted, fontWeight: 600 }}
        >
          На главную
        </Button>
        <Box
          onClick={() => navigate('/')}
          sx={{ cursor: 'pointer', display: { xs: 'none', sm: 'block' } }}
        >
          <BrandLogo size={36} layout="horizontal" withWordmark wordmarkSize={12} />
        </Box>
      </Box>

      <Box
        sx={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          px: { xs: 2, sm: 3, md: 4 },
          pb: { xs: 3, md: 4 },
        }}
      >
        <Box
          sx={{
            width: '100%',
            maxWidth: showSidePanel ? 960 : WIDTHS[width],
            display: 'grid',
            gridTemplateColumns: showSidePanel ? '0.92fr 1.08fr' : '1fr',
            gap: { md: 3 },
            alignItems: 'stretch',
          }}
        >
          {showSidePanel && (
            <Box
              sx={{
                borderRadius: `${radii.card}px`,
                background: `linear-gradient(160deg, ${colors.primary} 0%, ${colors.primaryDark} 100%)`,
                color: colors.white,
                p: { md: 4 },
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                minHeight: 420,
                boxShadow: '0 20px 50px rgba(13, 75, 215, 0.28)',
              }}
            >
              <Box>
                <Box sx={{ filter: 'brightness(0) invert(1)', mb: 3, display: 'inline-flex' }}>
                  <BrandLogo size={48} layout="horizontal" withWordmark wordmarkSize={14} />
                </Box>
                <Typography sx={{ fontWeight: 800, fontSize: 28, letterSpacing: '-0.03em', lineHeight: 1.15, mb: 1.5 }}>
                  Кабинет секции
                  <br />и ученика
                </Typography>
                <Typography sx={{ opacity: 0.9, fontSize: 15, lineHeight: 1.55, maxWidth: 280 }}>
                  Один вход для школы, тренера, ученика и родителя — продолжение публичного сайта
                  ПРОФСПОРТСРМ.
                </Typography>
              </Box>
              <Box sx={{ mt: 4 }}>
                <Box sx={{ height: 3, width: 64, bgcolor: colors.primarySoft, borderRadius: 2, mb: 1.5 }} />
                <Typography sx={{ fontSize: 13, opacity: 0.85 }}>
                  Клиенты · расписание · финансы · ЛК семьи
                </Typography>
                {asideExtra && <Box sx={{ mt: 3 }}>{asideExtra}</Box>}
              </Box>
            </Box>
          )}

          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              gap: { xs: 2.5, md: 3 },
              width: '100%',
              maxWidth: showSidePanel ? '100%' : WIDTHS[width],
              mx: 'auto',
            }}
          >
            {isCompact && (
              <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                <BrandLogo size={48} layout="horizontal" withWordmark wordmarkSize={13} />
              </Box>
            )}
            {titleBlock}
            {cardInner}
            {isCompact && belowCard ? <Box>{belowCard}</Box> : null}
          </Box>
        </Box>
      </Box>

      <Box
        sx={{
          textAlign: 'center',
          py: 2,
          display: 'flex',
          justifyContent: 'center',
          gap: 2.5,
          flexWrap: 'wrap',
          borderTop: `1px solid ${colors.divider}`,
          bgcolor: 'rgba(255,255,255,0.65)',
        }}
      >
        <Typography
          component="button"
          type="button"
          onClick={() => navigate('/terms')}
          sx={{
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            color: colors.textMuted,
            fontSize: typography.label,
            fontFamily: 'inherit',
            p: 0,
            '&:hover': { color: colors.primary, textDecoration: 'underline' },
          }}
        >
          Пользовательское соглашение
        </Typography>
        <Typography
          component="button"
          type="button"
          onClick={() => navigate('/privacy')}
          sx={{
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            color: colors.textMuted,
            fontSize: typography.label,
            fontFamily: 'inherit',
            p: 0,
            '&:hover': { color: colors.primary, textDecoration: 'underline' },
          }}
        >
          Политика конфиденциальности
        </Typography>
        <Typography
          component="button"
          type="button"
          onClick={() => navigate('/faq')}
          sx={{
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            color: colors.textMuted,
            fontSize: typography.label,
            fontFamily: 'inherit',
            p: 0,
            '&:hover': { color: colors.primary, textDecoration: 'underline' },
          }}
        >
          FAQ
        </Typography>
      </Box>
    </Box>
  );
};

export default AuthShell;
