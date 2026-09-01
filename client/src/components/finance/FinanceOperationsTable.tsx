import React from 'react';
import { Box, Typography } from '@mui/material';
import DesignIcon from '../common/DesignIcon';
import { FinanceOperation } from '../../types';
import { colors, typography } from '../../theme/tokens';
import ClientNameLink from '../ClientNameLink';

const ROW_CELL_MUTED = 'rgba(139, 140, 143, 0.56)';
const INCOME_COLOR = colors.success;

export type FinanceOpSortKey = 'title' | 'typeCode' | 'amount' | 'occurredAt';

interface FinanceOperationsTableProps {
  operations: FinanceOperation[];
  sortBy: FinanceOpSortKey;
  sortDir: 'asc' | 'desc';
  onSort: (key: FinanceOpSortKey) => void;
  formatMoney: (value: number, withSign?: boolean, direction?: string) => string;
  formatDateTime: (iso: string) => string;
}

const COLS =
  'minmax(220px, 1.5fr) minmax(160px, 1fr) minmax(120px, 0.7fr) minmax(180px, 1fr)';

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
    <DesignIcon category="ui" name="sort" size={18} sx={{ color: active ? colors.primary : colors.textHint, opacity: 0.85 }} />
    <Typography sx={{ fontSize: { xs: 16, md: 20, lg: 24 }, fontWeight: 500, color: colors.text }}>
      {label}
    </Typography>
  </Box>
);

/**
 * Таблица операций по макету Figma 243:1295:
 * сегментированные строки, чередующиеся фоны колонок.
 */
const FinanceOperationsTable: React.FC<FinanceOperationsTableProps> = ({
  operations,
  sortBy,
  sortDir: _sortDir,
  onSort,
  formatMoney,
  formatDateTime,
}) => {
  if (operations.length === 0) {
    return (
      <Box sx={{ py: 6, textAlign: 'center' }}>
        <Typography sx={{ color: colors.textEmpty, fontSize: typography.label }}>
          Операций пока нет
        </Typography>
      </Box>
    );
  }

  const toggle = (key: FinanceOpSortKey) => {
    onSort(key);
  };

  return (
    <Box sx={{ overflowX: 'auto' }}>
      <Box sx={{ minWidth: 720 }}>
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
          <SortHeader label="Наименование операции" active={sortBy === 'title'} onClick={() => toggle('title')} />
          <SortHeader label="Тип операции" active={sortBy === 'typeCode'} onClick={() => toggle('typeCode')} />
          <SortHeader label="Сумма" active={sortBy === 'amount'} onClick={() => toggle('amount')} />
          <SortHeader label="Дата и время" active={sortBy === 'occurredAt'} onClick={() => toggle('occurredAt')} />
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {operations.map((op, index) => {
            const isEven = index % 2 === 0;
            const col1Bg = isEven ? colors.divider : colors.divider;
            const col2Bg = ROW_CELL_MUTED;
            const col3Bg = isEven ? colors.divider : colors.divider;
            const col4Bg = ROW_CELL_MUTED;
            const isIncome = op.direction === 'income';

            const titleNode =
              op.clientId && op.client ? (
                <ClientNameLink
                  clientId={op.clientId}
                  client={op.client}
                  name={op.title}
                  sx={{
                    fontSize: { xs: 14, md: 18, lg: 22 },
                    fontWeight: 500,
                    color: colors.text,
                    '&:hover': { color: colors.primary },
                  }}
                />
              ) : (
                <Typography
                  component="span"
                  sx={{ fontSize: { xs: 14, md: 18, lg: 22 }, fontWeight: 500, color: colors.text }}
                >
                  {op.title}
                </Typography>
              );

            return (
              <Box
                key={op.id}
                sx={{
                  display: 'grid',
                  gridTemplateColumns: COLS,
                  gap: 0,
                  minHeight: 61,
                  alignItems: 'stretch',
                }}
              >
                <Box
                  sx={{
                    bgcolor: col1Bg,
                    borderTop: `1px solid ${colors.textMuted}`,
                    borderBottom: index === operations.length - 1 ? `1px solid ${colors.textMuted}` : undefined,
                    borderTopLeftRadius: '16px',
                    borderBottomLeftRadius: index === operations.length - 1 ? '16px' : 0,
                    px: 2.5,
                    py: 1.75,
                    display: 'flex',
                    alignItems: 'center',
                    minWidth: 0,
                  }}
                >
                  {titleNode}
                </Box>
                <Box
                  sx={{
                    bgcolor: col2Bg,
                    borderTop: `1px solid ${colors.textMuted}`,
                    borderBottom: index === operations.length - 1 ? `1px solid ${colors.textMuted}` : undefined,
                    px: 2.5,
                    py: 1.75,
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <Typography sx={{ fontSize: { xs: 14, md: 18, lg: 22 }, fontWeight: 500, color: colors.text }}>
                    {op.typeName || op.typeCode}
                  </Typography>
                </Box>
                <Box
                  sx={{
                    bgcolor: col3Bg,
                    borderTop: `1px solid ${colors.textMuted}`,
                    borderBottom: index === operations.length - 1 ? `1px solid ${colors.textMuted}` : undefined,
                    px: 2,
                    py: 1.75,
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <Typography
                    sx={{
                      fontSize: { xs: 14, md: 18, lg: 22 },
                      fontWeight: 600,
                      color: isIncome ? INCOME_COLOR : colors.text,
                    }}
                  >
                    {formatMoney(op.amount, true, op.direction)}
                  </Typography>
                </Box>
                <Box
                  sx={{
                    bgcolor: col4Bg,
                    borderTop: `1px solid ${colors.textMuted}`,
                    borderBottom: index === operations.length - 1 ? `1px solid ${colors.textMuted}` : undefined,
                    borderTopRightRadius: '16px',
                    borderBottomRightRadius: index === operations.length - 1 ? '16px' : 0,
                    px: 2,
                    py: 1.75,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    flexWrap: 'wrap',
                  }}
                >
                  <Typography sx={{ fontSize: { xs: 14, md: 18, lg: 22 }, fontWeight: 500, color: colors.text }}>
                    {formatDateTime(op.occurredAt).split(' ')[0]}
                  </Typography>
                  <Typography sx={{ fontSize: { xs: 14, md: 18, lg: 22 }, fontWeight: 500, color: colors.textMuted }}>
                    {formatDateTime(op.occurredAt).split(' ')[1] || ''}
                  </Typography>
                </Box>
              </Box>
            );
          })}
        </Box>
      </Box>
    </Box>
  );
};

export default FinanceOperationsTable;
