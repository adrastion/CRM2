import React from 'react';
import { Box, Typography } from '@mui/material';
import { colors, radii, typography } from '../../theme/tokens';

interface PanelProps {
  title?: React.ReactNode;
  /** Правый слот заголовка: кнопка, селектор периода. */
  action?: React.ReactNode;
  children: React.ReactNode;
  /** Убрать внутренние отступы (для таблиц во всю ширину). */
  flush?: boolean;
  /** Фиксированная минимальная высота — чтобы сетка не «дышала». */
  minHeight?: number | string;
  /** Нижний колонтитул панели. */
  footer?: React.ReactNode;
  /** Плотная desktop-компоновка для информационных списков. */
  compact?: boolean;
}

/** Белая карточка дашборда с заголовком — базовый блок макета. */
const Panel: React.FC<PanelProps> = ({ title, action, children, flush, minHeight, footer, compact }) => (
  <Box
    sx={{
      bgcolor: colors.card,
      borderRadius: `${radii.panel}px`,
      boxShadow: '0 4px 18px rgba(32, 34, 36, 0.06)',
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      minHeight,
      overflow: 'hidden',
    }}
  >
    {(title || action) && (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2,
          px: { xs: 2, md: compact ? 1.5 : 2.5 },
          pt: { xs: 2, md: compact ? 1.25 : 2 },
          pb: title ? (compact ? 0.6 : 1) : 0,
        }}
      >
        {title && (
          <Typography
            component="h2"
            sx={{
              fontSize: {
                xs: typography.panelTitle.xs,
                sm: typography.panelTitle.sm,
                md: compact ? 12 : typography.panelTitle.md,
              },
              fontWeight: 700,
              color: colors.text,
              lineHeight: 1.2,
            }}
          >
            {title}
          </Typography>
        )}
        {action}
      </Box>
    )}

    <Box
      sx={{
        flex: 1,
        minHeight: 0,
        px: flush ? 0 : { xs: 2, md: compact ? 1.5 : 2.5 },
        pt: title ? (compact ? 0.6 : 1) : { xs: 2, md: compact ? 1.25 : 2 },
        pb: flush ? 0 : { xs: 2, md: compact ? 1.5 : 2.5 },
      }}
    >
      {children}
    </Box>

    {footer && (
      <Box sx={{ px: { xs: 2, md: compact ? 1.5 : 2.5 }, pb: { xs: 2, md: compact ? 1.5 : 2.5 } }}>
        {footer}
      </Box>
    )}
  </Box>
);

export default Panel;
