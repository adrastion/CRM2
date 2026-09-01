import React from 'react';
import { Box, Typography, InputBase, ButtonBase } from '@mui/material';
import { Client } from '../../types';
import { colors, typography } from '../../theme/tokens';
import ClientNameLink from '../ClientNameLink';
import DesignIcon from '../common/DesignIcon';

const SOFT_DANGER = '#EC7C94';

export interface ClientsListProps {
  clients: Client[];
  searchQuery: string;
  onSearchChange: (value: string) => void;
  sortBy: string;
  onSort: (key: string) => void;
  onEdit: (client: Client) => void;
  onMemberships: (client: Client) => void;
  onDelete: (clientId: string) => void;
  onGroupClick?: (client: Client) => void;
  /** Доп. действия (добавить / импорт / экспорт) — вне макета, но нужны в продукте. */
  toolbarActions?: React.ReactNode;
}

const formatBalance = (value?: number) => {
  const n = Number(value ?? 0);
  return `${n.toLocaleString('ru-RU', { maximumFractionDigits: 0 })} ₽`;
};

const primaryGroupName = (client: Client): string => {
  const active = (client.groupMemberships || []).filter((gm: any) => gm.isActive);
  if (active.length === 0) return '—';
  return active[0].group?.name || 'Группа';
};

const SortHeader: React.FC<{
  label: string;
  active: boolean;
  onClick?: () => void;
  sortable?: boolean;
  center?: boolean;
}> = ({ label, active, onClick, sortable = true, center }) => (
  <Box
    component={sortable ? 'button' : 'div'}
    type={sortable ? 'button' : undefined}
    onClick={sortable ? onClick : undefined}
    sx={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: center ? 'center' : 'flex-start',
      gap: 1,
      border: 'none',
      background: 'none',
      cursor: sortable ? 'pointer' : 'default',
      p: 0,
      color: colors.text,
    }}
  >
    {sortable && (
      <DesignIcon
        category="ui"
        name="sort"
        size={18}
        muted={!active}
        sx={{ opacity: active ? 1 : 0.7 }}
      />
    )}
    <Typography
      sx={{
        fontSize: { xs: 16, md: 20, lg: 24 },
        fontWeight: 500,
        lineHeight: 1.2,
        color: colors.text,
      }}
    >
      {label}
    </Typography>
  </Box>
);

/**
 * Список клиентов по макету Figma 61:48:
 * заголовок + поиск, колонки Клиент / Статус / Группа / Баланс,
 * белые карточки с действиями Редактировать / Тарифы / Удалить.
 */
const ClientsList: React.FC<ClientsListProps> = ({
  clients,
  searchQuery,
  onSearchChange,
  sortBy,
  onSort,
  onEdit,
  onMemberships,
  onDelete,
  onGroupClick,
  toolbarActions,
}) => {
  const toggleSort = (key: string) => {
    onSort(key);
  };

  const gridTemplate =
    'minmax(220px, 1.4fr) minmax(160px, 0.9fr) minmax(160px, 1fr) minmax(100px, 0.6fr) minmax(120px, 0.55fr)';

  return (
    <Box data-onboarding="clients-page">
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2,
          mb: 2,
        }}
      >
        <Typography
          component="h1"
          sx={{
            fontWeight: 600,
            fontSize: typography.pageTitle,
            color: colors.text,
            lineHeight: 1.15,
          }}
        >
          Клиенты
        </Typography>

        <Box
          sx={{
            flex: '1 1 320px',
            maxWidth: 1119,
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            px: 3,
            py: 1.5,
            borderRadius: '19px',
            border: `1px solid ${colors.primary}`,
            bgcolor: colors.card,
            minHeight: 56,
          }}
        >
          <DesignIcon category="ui" name="search" size={22} />
          <InputBase
            fullWidth
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Поиск по ФИО клиента, тренера, названию операции или организации"
            sx={{
              fontSize: { xs: 14, md: 18, lg: 22 },
              fontWeight: 500,
              color: colors.text,
              '& input::placeholder': {
                color: colors.textHint,
                opacity: 1,
              },
            }}
          />
        </Box>
      </Box>

      {toolbarActions && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, mb: 3 }} data-onboarding="clients-import-export">
          {toolbarActions}
        </Box>
      )}

      <Box
        role="row"
        sx={{
          display: { xs: 'none', md: 'grid' },
          gridTemplateColumns: gridTemplate,
          alignItems: 'center',
          px: { md: 3, lg: 5 },
          mb: 2,
          gap: 0,
        }}
      >
        <SortHeader
          label="Клиент"
          active={sortBy === 'firstName'}
          onClick={() => toggleSort('firstName')}
        />
        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
          <SortHeader
            label="Статус"
            active={sortBy === 'isActive'}
            onClick={() => toggleSort('isActive')}
          />
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
          <SortHeader
            label="Группа"
            active={sortBy === 'group'}
            onClick={() => toggleSort('group')}
          />
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
          <SortHeader label="Баланс" active={false} sortable={false} center />
        </Box>
        <Box />
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }} data-onboarding="clients-table">
        {clients.length === 0 ? (
          <Box
            sx={{
              bgcolor: colors.card,
              borderRadius: '16px',
              py: 6,
              textAlign: 'center',
            }}
          >
            <Typography sx={{ color: colors.textEmpty, fontSize: typography.label }}>
              Клиенты не найдены
            </Typography>
          </Box>
        ) : (
          clients.map((client) => {
            const groupName = primaryGroupName(client);
            return (
              <Box
                key={client.id}
                sx={{
                  bgcolor: colors.card,
                  borderRadius: '16px',
                  boxShadow: '0 4px 18px rgba(32, 34, 36, 0.05)',
                  minHeight: { xs: 'auto', md: 152 },
                  display: 'grid',
                  gridTemplateColumns: {
                    xs: '1fr',
                    md: gridTemplate,
                  },
                  alignItems: 'center',
                  px: { xs: 2.5, md: 3, lg: 5 },
                  py: { xs: 2.5, md: 2 },
                  gap: { xs: 2, md: 0 },
                }}
              >
                {/* Клиент */}
                <Box
                  sx={{
                    pr: { md: 3 },
                    borderRight: { md: `1px solid ${colors.divider}` },
                    minWidth: 0,
                  }}
                >
                  <ClientNameLink
                    clientId={client.id}
                    client={client}
                    sx={{
                      fontWeight: 500,
                      fontSize: { xs: 16, md: 20, lg: 22 },
                      color: colors.text,
                      lineHeight: 1.25,
                      wordBreak: 'break-word',
                      display: 'block',
                      mb: 1,
                      '&:hover': {
                        color: colors.primary,
                      },
                    }}
                  />
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, minWidth: 0 }}>
                    <DesignIcon category="ui" name="phone" size={20} />
                    <Typography
                      sx={{
                        fontSize: { xs: 14, md: 16, lg: 18 },
                        color: colors.primary,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {client.phone || '—'}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                    <DesignIcon category="ui" name="email" size={20} />
                    <Typography
                      sx={{
                        fontSize: { xs: 14, md: 16, lg: 18 },
                        color: colors.primary,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {client.email || '—'}
                    </Typography>
                  </Box>
                </Box>

                {/* Статус */}
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'center',
                    px: { md: 2 },
                    borderRight: { md: `1px solid ${colors.divider}` },
                  }}
                >
                  <Box
                    sx={{
                      bgcolor: client.isActive ? colors.success : SOFT_DANGER,
                      color: colors.white,
                      px: 2,
                      py: 0.75,
                      borderRadius: '19px',
                      fontWeight: 600,
                      fontSize: { xs: 13, md: 14, lg: 16 },
                      whiteSpace: 'nowrap',
                      lineHeight: 1.2,
                    }}
                  >
                    {client.isActive ? 'Аккаунт активен' : 'Аккаунт не активен'}
                  </Box>
                </Box>

                {/* Группа */}
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'center',
                    px: { md: 2 },
                    borderRight: { md: `1px solid ${colors.divider}` },
                  }}
                >
                  <ButtonBase
                    onClick={() => onGroupClick?.(client)}
                    disabled={!onGroupClick}
                    sx={{
                      bgcolor: colors.primarySoft,
                      color: colors.primary,
                      px: 3,
                      py: 1.5,
                      borderRadius: '19px',
                      fontWeight: 600,
                      fontSize: { xs: 14, md: 18, lg: 20 },
                      textAlign: 'center',
                      maxWidth: '100%',
                      lineHeight: 1.2,
                    }}
                  >
                    <Typography
                      component="span"
                      sx={{
                        fontWeight: 600,
                        fontSize: 'inherit',
                        color: 'inherit',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        maxWidth: 220,
                      }}
                    >
                      {groupName}
                    </Typography>
                  </ButtonBase>
                </Box>

                {/* Баланс */}
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: { xs: 'flex-start', md: 'center' },
                    px: { md: 2 },
                    borderRight: { md: `1px solid ${colors.divider}` },
                  }}
                >
                  <Typography
                    sx={{
                      fontWeight: 500,
                      fontSize: { xs: 16, md: 20, lg: 22 },
                      color: colors.text,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {formatBalance(client.balance)}
                  </Typography>
                </Box>

                {/* Действия */}
                <Box
                  sx={{
                    display: 'flex',
                    flexDirection: { xs: 'row', md: 'column' },
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 1,
                    pl: { md: 1 },
                    flexWrap: 'wrap',
                  }}
                >
                  <ButtonBase
                    onClick={() => onEdit(client)}
                    sx={{
                      bgcolor: colors.primarySoft,
                      color: colors.text,
                      px: 2,
                      py: 0.75,
                      borderRadius: '19px',
                      fontWeight: 600,
                      fontSize: 14,
                      minWidth: 118,
                    }}
                  >
                    Редактировать
                  </ButtonBase>
                  <ButtonBase
                    onClick={() => onMemberships(client)}
                    sx={{
                      bgcolor: colors.primarySoft,
                      color: colors.text,
                      px: 2,
                      py: 0.75,
                      borderRadius: '19px',
                      fontWeight: 600,
                      fontSize: 14,
                      minWidth: 118,
                    }}
                  >
                    Тарифы
                  </ButtonBase>
                  <ButtonBase
                    onClick={() => onDelete(client.id)}
                    sx={{
                      bgcolor: SOFT_DANGER,
                      color: colors.white,
                      px: 2,
                      py: 0.75,
                      borderRadius: '19px',
                      fontWeight: 600,
                      fontSize: 14,
                      minWidth: 118,
                    }}
                  >
                    Удалить
                  </ButtonBase>
                </Box>
              </Box>
            );
          })
        )}
      </Box>
    </Box>
  );
};

export default ClientsList;
