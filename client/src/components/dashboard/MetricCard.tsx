import React from 'react';
import { Box, Typography } from '@mui/material';
import { ArrowUpward, ArrowDownward } from '@mui/icons-material';
import { colors, radii, typography } from '../../theme/tokens';

interface MetricCardProps {
  label: string;
  value: React.ReactNode;
  icon: React.ReactNode;
  /** Прирост в процентах: положительный — зелёная стрелка вверх. */
  trend?: number | null;
  trendLabel?: string;
  /** Полоса прогресса под значением (как у «Баланса» и «Посещаемости»). */
  progress?: { value: number; max: number; danger?: boolean } | null;
  /** Дополнительная строка под значением. */
  caption?: string;
  /** Заглушка: значения скрыты, карточка неактивна. */
  placeholder?: boolean;
}

/**
 * KPI-карточка из макета: подпись, крупное значение, синяя иконка справа,
 * при необходимости — полоса прогресса и строка прироста.
 */
const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  icon,
  trend,
  trendLabel,
  progress,
  caption,
  placeholder,
}) => {
  const progressPercent =
    progress && progress.max > 0 ? Math.min(100, Math.round((progress.value / progress.max) * 100)) : 0;

  return (
    <Box
      aria-hidden={placeholder || undefined}
      sx={{
        bgcolor: colors.card,
        borderRadius: `${radii.panel}px`,
        boxShadow: '0 4px 18px rgba(32, 34, 36, 0.06)',
        p: { xs: 2.5, md: 3 },
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
        opacity: placeholder ? 0.55 : 1,
        userSelect: placeholder ? 'none' : 'auto',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography
            sx={{
              fontSize: typography.label,
              color: colors.textMuted,
              fontWeight: 500,
              mb: 1,
            }}
          >
            {label}
          </Typography>
          <Typography
            sx={{
              fontSize: typography.metric,
              fontWeight: 700,
              color: colors.text,
              lineHeight: 1.05,
              letterSpacing: '-0.02em',
            }}
          >
            {placeholder ? '—' : value}
          </Typography>
        </Box>

        <Box
          aria-hidden
          sx={{
            flexShrink: 0,
            width: { xs: 48, md: 60 },
            height: { xs: 48, md: 60 },
            borderRadius: '16px',
            bgcolor: placeholder ? colors.divider : colors.primary,
            color: colors.white,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            '& svg': { fontSize: { xs: 26, md: 32 } },
          }}
        >
          {icon}
        </Box>
      </Box>

      {progress && !placeholder && (
        <Box
          sx={{
            height: 8,
            borderRadius: '999px',
            bgcolor: colors.divider,
            overflow: 'hidden',
          }}
        >
          <Box
            sx={{
              width: `${progressPercent}%`,
              height: '100%',
              bgcolor: progress.danger ? colors.danger : colors.success,
              transition: 'width 320ms ease',
            }}
          />
        </Box>
      )}

      {progress && placeholder && (
        <Box sx={{ height: 8, borderRadius: '999px', bgcolor: colors.divider }} />
      )}

      {typeof trend === 'number' && !placeholder && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <Box
            aria-hidden
            sx={{
              width: 26,
              height: 26,
              borderRadius: '50%',
              bgcolor: trend >= 0 ? colors.success : colors.danger,
              color: colors.white,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              '& svg': { fontSize: 16 },
            }}
          >
            {trend >= 0 ? <ArrowUpward /> : <ArrowDownward />}
          </Box>
          <Typography sx={{ fontSize: typography.label, fontWeight: 600, color: colors.text }}>
            {trend >= 0 ? '+' : ''}
            {trend}%
          </Typography>
          <Typography sx={{ fontSize: typography.hint, color: colors.textMuted }}>
            {trendLabel || 'Прирост со вчерашнего дня'}
          </Typography>
        </Box>
      )}

      {caption && !placeholder && (
        <Typography sx={{ fontSize: typography.hint, color: colors.textMuted }}>
          {caption}
        </Typography>
      )}
    </Box>
  );
};

export default MetricCard;
