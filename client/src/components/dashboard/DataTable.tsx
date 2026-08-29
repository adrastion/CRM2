import React from 'react';
import { Box, Typography } from '@mui/material';
import { colors, radii, typography } from '../../theme/tokens';

export interface DataColumn<T> {
  key: string;
  label: string;
  /** Значение ячейки. */
  render: (row: T) => React.ReactNode;
  /** Минимальная ширина колонки. */
  width?: number | string;
  align?: 'left' | 'right' | 'center';
}

interface DataTableProps<T> {
  columns: Array<DataColumn<T>>;
  rows: T[];
  rowKey: (row: T) => string;
  emptyText?: string;
}

/**
 * Таблица в стиле макета: светло-синяя шапка, чередующиеся строки,
 * горизонтальная прокрутка на узких экранах.
 */
function DataTable<T>({ columns, rows, rowKey, emptyText = 'Нет данных' }: DataTableProps<T>) {
  if (rows.length === 0) {
    return (
      <Box
        sx={{
          minHeight: 140,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Typography sx={{ color: colors.textEmpty, fontSize: typography.label }}>
          {emptyText}
        </Typography>
      </Box>
    );
  }

  const template = columns
    .map((c) => (typeof c.width === 'number' ? `${c.width}px` : c.width || 'minmax(120px, 1fr)'))
    .join(' ');

  return (
    <Box sx={{ overflowX: 'auto' }}>
      <Box sx={{ minWidth: 640 }}>
        <Box
          role="row"
          sx={{
            display: 'grid',
            gridTemplateColumns: template,
            gap: 2,
            px: 2,
            py: 1.5,
            borderRadius: `${radii.cell}px`,
            bgcolor: colors.primarySoft,
            mb: 1,
          }}
        >
          {columns.map((c) => (
            <Typography
              key={c.key}
              role="columnheader"
              sx={{
                fontSize: typography.hint,
                fontWeight: 700,
                color: colors.text,
                textAlign: c.align || 'left',
              }}
            >
              {c.label}
            </Typography>
          ))}
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
          {rows.map((row, i) => (
            <Box
              key={rowKey(row)}
              role="row"
              sx={{
                display: 'grid',
                gridTemplateColumns: template,
                gap: 2,
                alignItems: 'center',
                px: 2,
                py: 1.5,
                borderRadius: `${radii.cell}px`,
                bgcolor: i % 2 === 0 ? colors.surface : colors.rowAlt,
              }}
            >
              {columns.map((c) => (
                <Box
                  key={c.key}
                  role="cell"
                  sx={{
                    fontSize: typography.label,
                    color: colors.text,
                    textAlign: c.align || 'left',
                    minWidth: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {c.render(row)}
                </Box>
              ))}
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  );
}

export default DataTable;
