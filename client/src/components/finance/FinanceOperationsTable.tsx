import React, { useState } from 'react';
import { Box, Chip, IconButton, Menu, MenuItem, Typography } from '@mui/material';
import {
  MoreVert,
  PeopleOutline,
  FitnessCenterOutlined,
  ApartmentOutlined,
  ShoppingCartOutlined,
  CampaignOutlined,
  CreditCardOutlined,
  CardGiftcardOutlined,
  AccountBalanceOutlined,
  PaymentsOutlined,
  SwapHorizOutlined,
} from '@mui/icons-material';
import { FinanceOperation } from '../../types';
import { colors, radii, typography } from '../../theme/tokens';
import ClientNameLink from '../ClientNameLink';

export type FinanceOpSortKey = 'title' | 'typeCode' | 'amount' | 'occurredAt';

interface FinanceOperationsTableProps {
  operations: FinanceOperation[];
  sortBy: FinanceOpSortKey;
  sortDir: 'asc' | 'desc';
  onSort: (key: FinanceOpSortKey) => void;
  formatMoney: (value: number, withSign?: boolean, direction?: string) => string;
  formatDateTime: (iso: string) => string;
  onDelete?: (op: FinanceOperation) => void;
  onRowClick?: (op: FinanceOperation) => void;
  onOpenClient?: (clientId: string) => void;
  deletingId?: string | null;
}

const COLS =
  '48px minmax(200px, 1.6fr) minmax(130px, 0.9fr) minmax(110px, 0.7fr) minmax(150px, 1fr) 48px';

const EXPENSE_COLOR = '#F93C65';
const INCOME_COLOR = colors.success;
const NEUTRAL_AMOUNT = '#8B93A7';

type Visual = { bg: string; color: string; Icon: React.ElementType };

const visualForType = (typeCode: string, direction: string): Visual => {
  const c = (typeCode || '').toLowerCase();
  if (/salary|bonus|зарплат|преми/.test(c)) {
    return { bg: '#FFF1E8', color: '#F08A4B', Icon: FitnessCenterOutlined };
  }
  if (/rent|аренд/.test(c)) {
    return { bg: '#EEF2FF', color: '#3B4C7A', Icon: ApartmentOutlined };
  }
  if (/purchase|покуп/.test(c)) {
    return { bg: '#FFF4F0', color: '#E85D8E', Icon: ShoppingCartOutlined };
  }
  if (/ad|advert|реклам/.test(c)) {
    return { bg: '#F3EEFF', color: '#7C5CFC', Icon: CampaignOutlined };
  }
  if (/membership_issue|выдач/.test(c)) {
    return { bg: '#EAF0FF', color: '#2F6BFF', Icon: CardGiftcardOutlined };
  }
  if (/membership|abon|абонемент|payment|оплат/.test(c)) {
    return { bg: '#E8F8F2', color: '#00B69B', Icon: CreditCardOutlined };
  }
  if (/adjust|коррект/.test(c)) {
    return { bg: '#F5F6FA', color: '#5D6B86', Icon: SwapHorizOutlined };
  }
  if (/bank|перевод/.test(c)) {
    return { bg: '#EAF0FF', color: '#2F6BFF', Icon: AccountBalanceOutlined };
  }
  if (direction === 'income') {
    return { bg: '#E8F8F2', color: '#00B69B', Icon: PeopleOutline };
  }
  if (direction === 'expense') {
    return { bg: '#FFF1E8', color: '#F08A4B', Icon: PaymentsOutlined };
  }
  return { bg: '#EAF0FF', color: '#2F6BFF', Icon: PaymentsOutlined };
};

const directionChip = (op: FinanceOperation) => {
  const amount = Number(op.amount) || 0;
  if (op.direction === 'income') {
    return { label: 'Поступление', bg: '#E8F8F2', color: '#00B69B' };
  }
  if (op.direction === 'expense') {
    return { label: 'Расход', bg: '#FFE8EE', color: EXPENSE_COLOR };
  }
  if (amount === 0 || /membership_issue|выдач/.test((op.typeCode || '').toLowerCase())) {
    return { label: 'Операция', bg: '#EAF0FF', color: '#2F6BFF' };
  }
  return { label: op.typeName || 'Операция', bg: '#F5F6FA', color: '#5D6B86' };
};

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
      gap: 0.75,
      border: 'none',
      background: 'none',
      cursor: 'pointer',
      p: 0,
      color: colors.text,
    }}
  >
    <Typography
      sx={{
        fontSize: 11,
        fontWeight: 800,
        color: active ? colors.primary : '#8B93A7',
        letterSpacing: '0.01em',
      }}
    >
      {label}
    </Typography>
  </Box>
);

/**
 * Таблица операций — макет «Финансы - Все операции».
 */
const FinanceOperationsTable: React.FC<FinanceOperationsTableProps> = ({
  operations,
  sortBy,
  sortDir: _sortDir,
  onSort,
  formatMoney,
  formatDateTime,
  onDelete,
  onRowClick,
  onOpenClient,
  deletingId,
}) => {
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [menuOp, setMenuOp] = useState<FinanceOperation | null>(null);

  if (operations.length === 0) {
    return (
      <Box sx={{ py: 6, textAlign: 'center' }}>
        <Typography sx={{ color: colors.textEmpty, fontSize: typography.label }}>
          Операций пока нет
        </Typography>
      </Box>
    );
  }

  const openMenu = (e: React.MouseEvent<HTMLElement>, op: FinanceOperation) => {
    e.stopPropagation();
    setMenuAnchor(e.currentTarget);
    setMenuOp(op);
  };

  const closeMenu = () => {
    setMenuAnchor(null);
    setMenuOp(null);
  };

  const renderTitle = (op: FinanceOperation) =>
    op.clientId && op.client ? (
      <ClientNameLink
        clientId={op.clientId}
        client={op.client}
        name={op.title}
        onOpen={onOpenClient}
        sx={{
          fontSize: 13,
          fontWeight: 700,
          color: '#1B2438',
          '&:hover': { color: colors.primary },
        }}
      />
    ) : (
      <Typography component="span" sx={{ fontSize: 13, fontWeight: 700, color: '#1B2438' }}>
        {op.title}
      </Typography>
    );

  const amountColor = (op: FinanceOperation) => {
    if (op.direction === 'income') return INCOME_COLOR;
    if (op.direction === 'expense') return EXPENSE_COLOR;
    if (Number(op.amount) === 0) return NEUTRAL_AMOUNT;
    return colors.text;
  };

  const opMeta = (op: FinanceOperation) => {
    const visual = visualForType(op.typeCode, String(op.direction));
    const chip = directionChip(op);
    const dt = formatDateTime(op.occurredAt);
    const [datePart, timePart] = dt.split(' ');
    return { visual, chip, datePart, timePart };
  };

  const mobileCard = (op: FinanceOperation, index: number) => {
    const { visual, chip, datePart, timePart } = opMeta(op);
    const Icon = visual.Icon;

    return (
      <Box
        key={op.id}
        onClick={onRowClick ? () => onRowClick(op) : undefined}
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
          minWidth: 0,
          maxWidth: '100%',
          bgcolor: index % 2 === 0 ? '#fff' : '#FAFBFD',
          borderRadius: '16px',
          border: '1px solid #EEF1F6',
          px: 1.25,
          py: 1.15,
          cursor: onRowClick ? 'pointer' : 'default',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
          <Box
            sx={{
              width: 36,
              height: 36,
              flexShrink: 0,
              borderRadius: '10px',
              bgcolor: visual.bg,
              color: visual.color,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon sx={{ fontSize: 18 }} />
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            {renderTitle(op)}
            {(op.typeName || op.notes) && (
              <Typography
                sx={{
                  mt: 0.25,
                  fontSize: 11,
                  color: '#8B93A7',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {op.typeName || String(op.notes || '').replace(/\[[^\]]+\]/g, '').trim()}
              </Typography>
            )}
          </Box>
          <IconButton
            size="small"
            aria-label="Действия"
            onClick={(e) => openMenu(e, op)}
            sx={{ color: '#8B93A7', flexShrink: 0 }}
          >
            <MoreVert fontSize="small" />
          </IconButton>
        </Box>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1,
            flexWrap: 'wrap',
            minWidth: 0,
            pl: '44px',
          }}
        >
          <Chip
            size="small"
            label={chip.label}
            sx={{
              height: 24,
              fontWeight: 700,
              fontSize: 11,
              bgcolor: chip.bg,
              color: chip.color,
              borderRadius: '8px',
            }}
          />
          <Typography sx={{ fontSize: 13, fontWeight: 800, color: amountColor(op) }}>
            {formatMoney(op.amount, true, op.direction)}
          </Typography>
          <Box sx={{ textAlign: 'right', ml: 'auto' }}>
            <Typography sx={{ fontSize: 13, fontWeight: 600, color: '#1B2438' }}>{datePart}</Typography>
            {timePart && (
              <Typography sx={{ fontSize: 11, color: '#8B93A7' }}>{timePart}</Typography>
            )}
          </Box>
        </Box>
      </Box>
    );
  };

  const rowCard = (op: FinanceOperation, index: number) => {
    const { visual, chip, datePart, timePart } = opMeta(op);
    const Icon = visual.Icon;

    return (
      <Box
        key={op.id}
        onClick={onRowClick ? () => onRowClick(op) : undefined}
        sx={{
          display: 'grid',
          gridTemplateColumns: COLS,
          gap: 0,
          alignItems: 'center',
          bgcolor: index % 2 === 0 ? '#fff' : '#FAFBFD',
          borderRadius: '16px',
          border: '1px solid #EEF1F6',
          px: 1.25,
          py: 1.15,
          cursor: onRowClick ? 'pointer' : 'default',
          '&:hover': onRowClick ? { borderColor: '#D7E2FF', boxShadow: '0 4px 14px rgba(47,107,255,0.08)' } : undefined,
        }}
      >
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: '10px',
            bgcolor: visual.bg,
            color: visual.color,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon sx={{ fontSize: 18 }} />
        </Box>
        <Box sx={{ minWidth: 0, pr: 1 }}>
          {renderTitle(op)}
          {(op.typeName || op.notes) && (
            <Typography
              sx={{
                mt: 0.25,
                fontSize: 11,
                color: '#8B93A7',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {op.typeName || String(op.notes || '').replace(/\[[^\]]+\]/g, '').trim()}
            </Typography>
          )}
        </Box>
        <Box>
          <Chip
            size="small"
            label={chip.label}
            sx={{
              height: 24,
              fontWeight: 700,
              fontSize: 11,
              bgcolor: chip.bg,
              color: chip.color,
              borderRadius: '8px',
            }}
          />
        </Box>
        <Typography sx={{ fontSize: 13, fontWeight: 800, color: amountColor(op) }}>
          {formatMoney(op.amount, true, op.direction)}
        </Typography>
        <Box>
          <Typography sx={{ fontSize: 13, fontWeight: 600, color: '#1B2438' }}>{datePart}</Typography>
          {timePart && (
            <Typography sx={{ fontSize: 11, color: '#8B93A7' }}>{timePart}</Typography>
          )}
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
          <IconButton
            size="small"
            aria-label="Действия"
            onClick={(e) => openMenu(e, op)}
            sx={{ color: '#8B93A7' }}
          >
            <MoreVert fontSize="small" />
          </IconButton>
        </Box>
      </Box>
    );
  };

  return (
    <>
      <Box sx={{ display: { xs: 'flex', sm: 'none' }, flexDirection: 'column', gap: 1.25, minWidth: 0, maxWidth: '100%' }}>
        {operations.map((op, i) => mobileCard(op, i))}
      </Box>

      <Box sx={{ display: { xs: 'none', sm: 'block' }, overflowX: 'auto' }}>
        <Box sx={{ minWidth: 820 }}>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: COLS,
              gap: 0,
              px: 1.25,
              py: 1,
              mb: 1,
            }}
          >
            <Box />
            <SortHeader label="Наименование операции" active={sortBy === 'title'} onClick={() => onSort('title')} />
            <SortHeader label="Тип операции" active={sortBy === 'typeCode'} onClick={() => onSort('typeCode')} />
            <SortHeader label="Сумма" active={sortBy === 'amount'} onClick={() => onSort('amount')} />
            <SortHeader label="Дата и время" active={sortBy === 'occurredAt'} onClick={() => onSort('occurredAt')} />
            <Box />
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {operations.map((op, i) => rowCard(op, i))}
          </Box>
        </Box>
      </Box>

      <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={closeMenu}>
        <MenuItem
          onClick={() => {
            if (menuOp && onRowClick) onRowClick(menuOp);
            closeMenu();
          }}
        >
          Подробнее
        </MenuItem>
        {onDelete && (
          <MenuItem
            disabled={deletingId === menuOp?.id}
            onClick={() => {
              if (menuOp) onDelete(menuOp);
              closeMenu();
            }}
            sx={{ color: EXPENSE_COLOR }}
          >
            Отменить операцию
          </MenuItem>
        )}
      </Menu>
    </>
  );
};

export default FinanceOperationsTable;
