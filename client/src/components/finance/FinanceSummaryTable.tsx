import React from 'react';
import { Box, Typography } from '@mui/material';
import DesignIcon from '../common/DesignIcon';
import { colors, typography } from '../../theme/tokens';

export type FinanceSummarySortKey = 'name' | 'period' | 'count' | 'accrued' | 'paid' | 'remaining';

export interface FinanceSummaryRow {
  id: string;
  name: React.ReactNode;
  period: string;
  count: number | string;
  accrued: number;
  paid: number;
  remaining: number;
  onPaidClick?: () => void;
}

interface FinanceSummaryTableProps {
  nameColumnLabel: string;
  countColumnLabel?: string;
  rows: FinanceSummaryRow[];
  sortBy: FinanceSummarySortKey;
  onSort: (key: FinanceSummarySortKey) => void;
  formatMoney: (value: number) => string;
  emptyMessage: string;
}

const COLS =
  'minmax(180px, 1.3fr) minmax(120px, 0.8fr) minmax(110px, 0.65fr) minmax(130px, 0.75fr) minmax(130px, 0.75fr) minmax(120px, 0.65fr)';

const SortHeader: React.FC<{
  label: string;
  active: boolean;
  onClick: () => void;
}> = ({ label, active, onClick }) => (
  <Box
    component="button"
    type="button"
    onClick={onClick}
    sx={{
      display: 'flex',
      alignItems: 'center',
      gap: 1,
      border: 'none',
      background: 'none',
      cursor: 'pointer',
      p: 0,
      color: colors.text,
    }}
  >
    <DesignIcon category="ui" name="sort" size={18} muted={!active} sx={{ opacity: active ? 1 : 0.85 }} />
    <Typography sx={{ fontSize: typography.label, fontWeight: 600, color: colors.text }}>
      {label}
    </Typography>
  </Box>
);

/** Таблица «Зарплата тренеров» / «Оплата абонементов» по макету Figma 268:893 / 290:1556. */
const FinanceSummaryTable: React.FC<FinanceSummaryTableProps> = ({
  nameColumnLabel,
  countColumnLabel = 'Кол-во занятий',
  rows,
  sortBy,
  onSort,
  formatMoney,
  emptyMessage,
}) => {
  if (rows.length === 0) {
    return (
      <Box sx={{ py: 6, textAlign: 'center' }}>
        <Typography sx={{ color: colors.textEmpty, fontSize: typography.label }}>{emptyMessage}</Typography>
      </Box>
    );
  }

  const paidNode = (row: FinanceSummaryRow) => (
    <Box
      component={row.onPaidClick ? 'button' : 'div'}
      type={row.onPaidClick ? 'button' : undefined}
      onClick={row.onPaidClick}
      sx={{
        border: 'none',
        background: 'none',
        p: 0,
        m: 0,
        font: 'inherit',
        cursor: row.onPaidClick ? 'pointer' : 'default',
        textAlign: 'left',
        color: row.onPaidClick ? colors.primary : colors.text,
        '&:hover': row.onPaidClick ? { textDecoration: 'underline' } : undefined,
      }}
    >
      <Typography
        component="span"
        sx={{
          fontSize: typography.label,
          fontWeight: 600,
          color: 'inherit',
        }}
      >
        {formatMoney(row.paid)}
      </Typography>
    </Box>
  );

  return (
    <>
      {/* Mobile card list */}
      <Box sx={{ display: { xs: 'flex', sm: 'none' }, flexDirection: 'column', gap: 1.5 }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, px: 0.5, mb: 0.5 }}>
          <SortHeader label={nameColumnLabel} active={sortBy === 'name'} onClick={() => onSort('name')} />
          <SortHeader label="Остаток" active={sortBy === 'remaining'} onClick={() => onSort('remaining')} />
        </Box>
        {rows.map((row) => (
          <Box
            key={row.id}
            sx={{
              bgcolor: colors.divider,
              borderRadius: '16px',
              border: `1px solid ${colors.textMuted}`,
              p: 1.5,
              display: 'flex',
              flexDirection: 'column',
              gap: 0.75,
              minWidth: 0,
            }}
          >
            <Box sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>
              {typeof row.name === 'string' ? (
                <Typography sx={{ fontSize: typography.label, fontWeight: 600, color: colors.text }}>
                  {row.name}
                </Typography>
              ) : (
                row.name
              )}
            </Box>
            <Typography sx={{ fontSize: typography.hint, color: colors.textMuted }}>
              {row.period}
              {row.count !== '—' ? ` · ${countColumnLabel}: ${row.count}` : ''}
            </Typography>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr',
                gap: 1,
                mt: 0.5,
              }}
            >
              <Box>
                <Typography sx={{ fontSize: typography.hint, color: colors.textMuted }}>Начислено</Typography>
                <Typography sx={{ fontSize: typography.label, fontWeight: 500 }}>{formatMoney(row.accrued)}</Typography>
              </Box>
              <Box>
                <Typography sx={{ fontSize: typography.hint, color: colors.textMuted }}>Выплачено</Typography>
                {paidNode(row)}
              </Box>
              <Box>
                <Typography sx={{ fontSize: typography.hint, color: colors.textMuted }}>Остаток</Typography>
                <Typography sx={{ fontSize: typography.label, fontWeight: 600 }}>{formatMoney(row.remaining)}</Typography>
              </Box>
            </Box>
          </Box>
        ))}
      </Box>

      {/* Desktop / tablet table with horizontal scroll */}
      <Box sx={{ display: { xs: 'none', sm: 'block' }, overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <Box sx={{ minWidth: 900 }}>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: COLS,
              gap: 0,
              px: 1,
              py: 1.5,
              mb: 1.5,
            }}
          >
            <SortHeader label={nameColumnLabel} active={sortBy === 'name'} onClick={() => onSort('name')} />
            <SortHeader label="Период" active={sortBy === 'period'} onClick={() => onSort('period')} />
            <SortHeader label={countColumnLabel} active={sortBy === 'count'} onClick={() => onSort('count')} />
            <SortHeader label="Начислено" active={sortBy === 'accrued'} onClick={() => onSort('accrued')} />
            <SortHeader label="Выплачено" active={sortBy === 'paid'} onClick={() => onSort('paid')} />
            <SortHeader label="Остаток" active={sortBy === 'remaining'} onClick={() => onSort('remaining')} />
          </Box>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {rows.map((row, index) => {
              const isEven = index % 2 === 0;
              const cellBg = (alt: boolean) => (alt ? colors.divider : 'rgba(139, 140, 143, 0.56)');

              const cellSx = (colIndex: number, isLastCol: boolean) => ({
                bgcolor: cellBg(colIndex % 2 === (isEven ? 0 : 1)),
                borderTop: `1px solid ${colors.textMuted}`,
                borderBottom: index === rows.length - 1 ? `1px solid ${colors.textMuted}` : undefined,
                borderTopLeftRadius: colIndex === 0 ? '16px' : 0,
                borderBottomLeftRadius: colIndex === 0 && index === rows.length - 1 ? '16px' : 0,
                borderTopRightRadius: isLastCol ? '16px' : 0,
                borderBottomRightRadius: isLastCol && index === rows.length - 1 ? '16px' : 0,
                px: 1.5,
                py: 1,
                display: 'flex',
                alignItems: 'center',
                minWidth: 0,
              });

              return (
                <Box
                  key={row.id}
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: COLS,
                    gap: 0,
                    minHeight: 36,
                    alignItems: 'stretch',
                  }}
                >
                  <Box sx={cellSx(0, false)}>
                    {typeof row.name === 'string' ? (
                      <Typography sx={{ fontSize: typography.label, fontWeight: 500, color: colors.text }}>
                        {row.name}
                      </Typography>
                    ) : (
                      row.name
                    )}
                  </Box>
                  <Box sx={cellSx(1, false)}>
                    <Typography sx={{ fontSize: typography.label, fontWeight: 500, color: colors.text }}>
                      {row.period}
                    </Typography>
                  </Box>
                  <Box sx={cellSx(2, false)}>
                    <Typography sx={{ fontSize: typography.label, fontWeight: 500, color: colors.text }}>
                      {row.count}
                    </Typography>
                  </Box>
                  <Box sx={cellSx(3, false)}>
                    <Typography sx={{ fontSize: typography.label, fontWeight: 500, color: colors.text }}>
                      {formatMoney(row.accrued)}
                    </Typography>
                  </Box>
                  <Box sx={cellSx(4, false)}>{paidNode(row)}</Box>
                  <Box sx={cellSx(5, true)}>
                    <Typography sx={{ fontSize: typography.label, fontWeight: 600, color: colors.text }}>
                      {formatMoney(row.remaining)}
                    </Typography>
                  </Box>
                </Box>
              );
            })}
          </Box>
        </Box>
      </Box>
    </>
  );
};

export default FinanceSummaryTable;
