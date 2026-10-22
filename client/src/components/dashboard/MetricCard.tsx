import React from 'react';
import { Box, Typography } from '@mui/material';
import { ArrowUpward, ArrowDownward } from '@mui/icons-material';
import { colors, radii, typography } from '../../theme/tokens';

interface MetricCardProps {
  label: string;
  value: React.ReactNode;
  icon: React.ReactNode;
  /** Иконка из макета (SVG с синим фоном) — без дополнительной синей обёртки. */
  designIcon?: boolean;
  /** Прирост в процентах: положительный — зелёная стрелка вверх. */
  trend?: number | null;
  trendLabel?: string;
  /** Полоса прогресса под значением (как у «Баланса» и «Посещаемости»). */
  progress?: { value: number; max: number; danger?: boolean } | null;
  /** Дополнительная строка под значением. */
  caption?: string;
  /** Заглушка: значения скрыты, карточка неактивна. */
  placeholder?: boolean;
  /** Цвет декоративного спарклайна (макет десктоп-панели). */
  sparkColor?: string;
  /** Макет KPI: иконка слева, спарклайн справа, дельта за 7 дней. */
  sparkline?: boolean;
  /** Суффикс дельты: по умолчанию «%»; для абсолютных счётчиков — пустая строка. */
  trendSuffix?: string;
}

/** Декоративная SVG-кривая: знак дельты задаёт направление, без серии с API. */
const Sparkline: React.FC<{ color: string; direction: 'up' | 'down' | 'flat' }> = ({
  color,
  direction,
}) => {
  const d =
    direction === 'up'
      ? 'M2 28 C 18 26, 28 22, 40 16 S 64 6, 78 4'
      : direction === 'down'
        ? 'M2 4 C 18 6, 28 12, 40 18 S 64 26, 78 28'
        : 'M2 16 C 20 14, 36 18, 50 16 S 68 15, 78 16';
  const endY = direction === 'up' ? 4 : direction === 'down' ? 28 : 16;
  return (
    <Box
      aria-hidden
      component="svg"
      viewBox="0 0 80 32"
      sx={{ width: { xs: 72, md: 50 }, height: { xs: 28, md: 20 }, flexShrink: 0 }}
    >
      <path d={d} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="78" cy={endY} r="3.5" fill={color} />
    </Box>
  );
};

/**
 * KPI-карточка из макета: подпись, крупное значение, иконка,
 * при необходимости — полоса прогресса, прирост и спарклайн.
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
  designIcon,
  sparkColor = colors.primary,
  sparkline = false,
  trendSuffix = '%',
}) => {
  const progressPercent =
    progress && progress.max > 0 ? Math.min(100, Math.round((progress.value / progress.max) * 100)) : 0;

  const hasTrend = typeof trend === 'number' && Number.isFinite(trend);
  const sparkDir: 'up' | 'down' | 'flat' =
    hasTrend && (trend as number) > 0 ? 'up' : hasTrend && (trend as number) < 0 ? 'down' : 'flat';

  const iconBox = designIcon ? (
    <Box aria-hidden sx={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
      {icon}
    </Box>
  ) : (
    <Box
      aria-hidden
      sx={{
        flexShrink: 0,
        width: 36,
        height: 36,
        borderRadius: '10px',
        bgcolor: placeholder ? colors.divider : colors.primary,
        color: colors.white,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        '& svg': { fontSize: 20 },
      }}
    >
      {icon}
    </Box>
  );

  return (
    <Box
      aria-hidden={placeholder || undefined}
      sx={{
        bgcolor: colors.card,
        borderRadius: `${radii.panel}px`,
        boxShadow: '0 4px 18px rgba(32, 34, 36, 0.06)',
        p: { xs: 2, md: sparkline ? 1.25 : 2.5 },
        height: '100%',
        minHeight: { md: sparkline ? 84 : undefined },
        display: 'flex',
        flexDirection: 'column',
        gap: { xs: 1, md: sparkline ? 0.45 : 1 },
        position: 'relative',
        overflow: 'hidden',
        opacity: placeholder ? 0.55 : 1,
        userSelect: placeholder ? 'none' : 'auto',
      }}
    >
      {sparkline ? (
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 0.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.75, minWidth: 0, flex: 1 }}>
            {iconBox}
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography
                sx={{
                  fontSize: 12.5,
                  color: colors.textMuted,
                  fontWeight: 700,
                  mb: { xs: 0.75, md: 0.3 },
                }}
              >
                {label}
              </Typography>
              <Typography
                sx={{
                  fontSize: 22,
                  fontWeight: 800,
                  color: colors.text,
                  lineHeight: 1.05,
                  letterSpacing: '-0.02em',
                  whiteSpace: 'nowrap',
                }}
              >
                {placeholder ? '—' : value}
              </Typography>
            </Box>
          </Box>
          {!placeholder && (
            <Box sx={{ position: 'absolute', right: 10, bottom: 9, opacity: 0.9 }}>
              <Sparkline color={sparkColor} direction={sparkDir} />
            </Box>
          )}
        </Box>
      ) : (
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
          {iconBox}
        </Box>
      )}

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

      {sparkline && !placeholder && (
        hasTrend && (trend as number) !== 0 ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.35, flexWrap: 'wrap', pl: 4.75 }}>
            <Typography
              aria-hidden
              sx={{ fontSize: 10, lineHeight: 1, fontWeight: 800, color: (trend as number) >= 0 ? colors.success : colors.danger }}
            >
              {(trend as number) >= 0 ? '↑' : '↓'}
            </Typography>
            <Typography sx={{ fontSize: 9, fontWeight: 700, color: (trend as number) >= 0 ? colors.success : colors.danger }}>
              {(trend as number) >= 0 ? '+' : ''}
              {trend}
              {trendSuffix}
            </Typography>
            <Typography sx={{ fontSize: 8, color: colors.textMuted }}>
              {trendLabel || 'за 7 дней'}
            </Typography>
          </Box>
        ) : (
          <Typography sx={{ fontSize: 8, color: colors.textHint, pl: 4.75 }}>
            {hasTrend ? 'без изменений' : '—'}
          </Typography>
        )
      )}

      {!sparkline && typeof trend === 'number' && !placeholder && (
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
