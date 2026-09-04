import React from 'react';
import { Box, Typography, useMediaQuery, useTheme } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import BrandLogo from '../common/BrandLogo';
import { colors, radii, sizes, typography } from '../../theme/tokens';

interface AuthShellProps {
  /** Крупный синий заголовок над карточкой. */
  title: string;
  /** Вторая строка заголовка (например, «Сотрудника»). */
  titleSecondLine?: string;
  /** Ширина карточки: узкая для входа, широкая для выбора организации/регистрации. */
  width?: 'auth' | 'select' | 'register' | 'full';
  /** Содержимое карточки. Если false — дети рисуются без карточки. */
  card?: boolean;
  children: React.ReactNode;
}

const WIDTHS: Record<NonNullable<AuthShellProps['width']>, number | string> = {
  auth: sizes.authCardWidth,
  select: sizes.selectCardWidth,
  register: sizes.registerCardWidth,
  full: '100%',
};

/**
 * Общий каркас экранов авторизации по макету:
 * фирменный блок слева, заголовок и карточка справа, ссылка на соглашение внизу.
 */
const AuthShell: React.FC<AuthShellProps> = ({
  title,
  titleSecondLine,
  width = 'auth',
  card = true,
  children,
}) => {
  const navigate = useNavigate();
  const theme = useTheme();
  const isCompact = useMediaQuery(theme.breakpoints.down('lg'));

  const brand = <BrandLogo size={{ xs: 56, md: 80 }} wordmarkSize={{ xs: 16, md: 20 }} />;

  return (
    <Box
      sx={{
        minHeight: '100vh',
        bgcolor: colors.white,
        display: 'flex',
        flexDirection: 'column',
        px: { xs: 2, sm: 3, lg: 4 },
        py: { xs: 2, md: 3 },
      }}
    >
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: { lg: 6, xl: 10 },
        }}
      >
        {!isCompact && width !== 'register' && width !== 'full' && (
          <Box sx={{ flexShrink: 0, pb: 6 }}>{brand}</Box>
        )}

        <Box
          sx={{
            width: '100%',
            maxWidth: WIDTHS[width],
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: { xs: 3, md: 5 },
          }}
        >
          <Box sx={{ width: '100%', textAlign: 'center' }}>
            <Typography
              component="h1"
              sx={{
                color: colors.primary,
                fontWeight: 700,
                lineHeight: 1.1,
                fontSize: typography.authTitle,
              }}
            >
              {title}
              {titleSecondLine && (
                <>
                  <br />
                  {titleSecondLine}
                </>
              )}
            </Typography>
          </Box>

          {card ? (
            <Box
              sx={{
                width: '100%',
                bgcolor: colors.surface,
                borderRadius: `${radii.card}px`,
                px: { xs: 2, sm: 3, md: 4 },
                py: { xs: 2.5, md: 3.5 },
              }}
            >
              {children}
            </Box>
          ) : (
            <Box sx={{ width: '100%' }}>{children}</Box>
          )}

          {isCompact && <Box sx={{ pt: 2 }}>{brand}</Box>}
        </Box>
      </Box>

      <Box sx={{ textAlign: 'center', pt: { xs: 2, md: 3 } }}>
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
            '&:hover': { textDecoration: 'underline' },
          }}
        >
          Пользовательское соглашение
        </Typography>
      </Box>
    </Box>
  );
};

export default AuthShell;
