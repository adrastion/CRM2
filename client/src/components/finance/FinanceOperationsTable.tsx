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
    <Typography sx={{ fontSize: typography.label, fontWeight: 600, color: colors.text }}>
      {label}
    </Typography>
  </Box>
);

/**
 * Таблица операций по макету Figma 243:1295:
 * сегментированные строки, чередующиеся фоны колонок.
 * На xs — карточки; на sm+ — горизонтальный скролл таблицы.
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

  const renderTitle = (op: FinanceOperation) =>
    op.clientId && op.client ? (
      <ClientNameLink
        clientId={op.clientId}
        client={op.client}
        name={op.title}
        sx={{
          fontSize: typography.label,
          fontWeight: 500,
          color: colors.text,
          '&:hover': { color: colors.primary },
        }}
      />
    ) : (
      <Typography
        component="span"
        sx={{ fontSize: typography.label, fontWeight: 500, color: colors.text }}
      >
        {op.title}
      </Typography>
    );

  return (
    <>
      {/* Mobile card list */}
      <Box sx={{ display: { xs: 'flex', sm: 'none' }, flexDirection: 'column', gap: 1.5 }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, px: 0.5, mb: 0.5 }}>
          <SortHeader label="Название" active={sortBy === 'title'} onClick={() => toggle('title')} />
          <SortHeader label="Сумма" active={sortBy === 'amount'} onClick={() => toggle('amount')} />
          <SortHeader label="Дата" active={sortBy === 'occurredAt'} onClick={() => toggle('occurredAt')} />
        </Box>
        {operations.map((op) => {
          const isIncome = op.direction === 'income';
          return (
            <Box
              key={op.id}
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
              <Box sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>{renderTitle(op)}</Box>
              <Typography sx={{ fontSize: typography.hint, color: colors.textMuted }}>
                {op.typeName || op.typeCode}
              </Typography>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                <Typography
                  sx={{
                    fontSize: typography.label,
                    fontWeight: 600,
                    color: isIncome ? INCOME_COLOR : colors.text,
                  }}
                >
                  {formatMoney(op.amount, true, op.direction)}
                </Typography>
                <Typography sx={{ fontSize: typography.hint, color: colors.textMuted }}>
                  {formatDateTime(op.occurredAt)}
                </Typography>
              </Box>
            </Box>
          );
        })}
      </Box>

      {/* Desktop / tablet table with horizontal scroll */}
      <Box sx={{ display: { xs: 'none', sm: 'block' }, overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
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

              return (
                <Box
                  key={op.id}
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: COLS,
                    gap: 0,
                    minHeight: 44,
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
                      px: 1.5,
                      py: 1,
                      display: 'flex',
                      alignItems: 'center',
                      minWidth: 0,
                    }}
                  >
                    {renderTitle(op)}
                  </Box>
                  <Box
                    sx={{
                      bgcolor: col2Bg,
                      borderTop: `1px solid ${colors.textMuted}`,
                      borderBottom: index === operations.length - 1 ? `1px solid ${colors.textMuted}` : undefined,
                      px: 1.5,
                      py: 1,
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    <Typography sx={{ fontSize: typography.label, fontWeight: 500, color: colors.text }}>
                      {op.typeName || op.typeCode}
                    </Typography>
                  </Box>
                  <Box
                    sx={{
                      bgcolor: col3Bg,
                      borderTop: `1px solid ${colors.textMuted}`,
                      borderBottom: index === operations.length - 1 ? `1px solid ${colors.textMuted}` : undefined,
                      px: 1.5,
                      py: 1,
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    <Typography
                      sx={{
                        fontSize: typography.label,
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
                      px: 1.5,
                      py: 1,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      flexWrap: 'wrap',
                    }}
                  >
                    <Typography sx={{ fontSize: typography.label, fontWeight: 500, color: colors.text }}>
                      {formatDateTime(op.occurredAt).split(' ')[0]}
                    </Typography>
                    <Typography sx={{ fontSize: typography.label, fontWeight: 500, color: colors.textMuted }}>
                      {formatDateTime(op.occurredAt).split(' ')[1] || ''}
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

export default FinanceOperationsTable;
