import React from 'react';
import { Box, Typography } from '@mui/material';
import { colors, radii, typography } from '../../theme/tokens';

export interface ScheduleRow {
  id: string;
  /** Дата в формате «5.08». */
  dateLabel: string;
  /** Интервал «17:00-18:00». */
  timeLabel: string;
  /** Название группы или тренировки. */
  title: string;
  /** Иконка справа (тип занятия). */
  icon?: React.ReactNode;
  /** Цветовая метка группы. */
  color?: string | null;
}

interface ScheduleListProps {
  rows: ScheduleRow[];
  /** Заглушка: строки без текста, некликабельные. */
  placeholder?: boolean;
  /** Сколько строк-заглушек рисовать. */
  placeholderRows?: number;
  emptyText?: string;
}

/** Список тренировок недели: чередующиеся строки, первая выделена. */
const ScheduleList: React.FC<ScheduleListProps> = ({
  rows,
  placeholder,
  placeholderRows = 5,
  emptyText = 'Нет предстоящих тренировок',
}) => {
  if (placeholder) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, opacity: 0.55 }}>
        {Array.from({ length: placeholderRows }).map((_, i) => (
          <Box
            key={i}
            aria-hidden
            sx={{
              height: { xs: 52, md: 62 },
              borderRadius: `${radii.cell}px`,
              bgcolor: i === 0 ? colors.primarySoft : colors.rowAlt,
            }}
          />
        ))}
      </Box>
    );
  }

  if (rows.length === 0) {
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 160,
        }}
      >
        <Typography sx={{ color: colors.textEmpty, fontSize: typography.label }}>
          {emptyText}
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
      {rows.map((row, index) => (
        <Box
          key={row.id}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: { xs: 1.5, md: 2.5 },
            px: { xs: 1.5, md: 2.5 },
            py: { xs: 1.25, md: 1.75 },
            borderRadius: `${radii.cell}px`,
            bgcolor: index === 0 ? colors.primarySoft : colors.rowAlt,
          }}
        >
          <Typography
            sx={{
              fontSize: typography.label,
              fontWeight: 700,
              color: colors.textMuted,
              minWidth: { xs: 44, md: 58 },
            }}
          >
            {row.dateLabel}
          </Typography>
          <Typography
            sx={{
              fontSize: typography.label,
              color: colors.text,
              minWidth: { xs: 96, md: 132 },
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {row.timeLabel}
          </Typography>
          <Typography
            sx={{
              flex: 1,
              minWidth: 0,
              fontSize: typography.label,
              color: colors.text,
              fontWeight: 500,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {row.title}
          </Typography>
          {row.icon && (
            <Box
              aria-hidden
              sx={{
                flexShrink: 0,
                color: row.color || colors.primary,
                display: 'flex',
                '& svg': { fontSize: { xs: 22, md: 26 } },
              }}
            >
              {row.icon}
            </Box>
          )}
        </Box>
      ))}
    </Box>
  );
};

export default ScheduleList;
