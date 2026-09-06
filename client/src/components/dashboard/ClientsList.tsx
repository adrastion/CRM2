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
  onDelete: (clientId: string) => void;
  onGroupClick?: (client: Client) => void;
  onApproveAccount?: (client: Client) => void;
  onRejectAccount?: (client: Client) => void;
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
        fontSize: typography.label,
        fontWeight: 600,
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
const accountStatusLabel = (client: Client): string => {
  if (!client.hasPassword) return 'Не зарегистрирован';
  if (!client.isAccountApproved) return 'Ожидает подтверждения';
  return 'Зарегистрирован';
};

const accountStatusColor = (client: Client): string => {
  if (!client.hasPassword) return colors.textHint;
  if (!client.isAccountApproved) return '#ED6C02';
  return colors.success;
};

const ClientsList: React.FC<ClientsListProps> = ({
  clients,
  searchQuery,
  onSearchChange,
  sortBy,
  onSort,
  onEdit,
  onDelete,
  onGroupClick,
  onApproveAccount,
  onRejectAccount,
  toolbarActions,
}) => {
  const toggleSort = (key: string) => {
    onSort(key);
  };

  const gridTemplate =
    'minmax(200px, 1.3fr) minmax(180px, 1.1fr) minmax(140px, 0.9fr) minmax(90px, 0.55fr) minmax(120px, 0.55fr)';

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
            flex: '1 1 280px',
            maxWidth: 720,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            px: 2,
            py: 0.75,
            borderRadius: '12px',
            border: `1px solid ${colors.primary}`,
            bgcolor: colors.card,
            minHeight: 40,
          }}
        >
          <DesignIcon category="ui" name="search" size={18} />
          <InputBase
            fullWidth
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Поиск по ФИО, телефону, email…"
            sx={{
              fontSize: typography.field,
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
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1.5 }} data-onboarding="clients-import-export">
          {toolbarActions}
        </Box>
      )}

      <Box
        role="row"
        sx={{
          display: { xs: 'none', md: 'grid' },
          gridTemplateColumns: gridTemplate,
          alignItems: 'center',
          px: { md: 2 },
          mb: 1,
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
            label="Аккаунт"
            active={sortBy === 'accountStatus'}
            onClick={() => toggleSort('accountStatus')}
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

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }} data-onboarding="clients-table">
        {clients.length === 0 ? (
          <Box
            sx={{
              bgcolor: colors.card,
              borderRadius: '12px',
              py: 4,
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
                  borderRadius: '12px',
                  boxShadow: '0 2px 8px rgba(32, 34, 36, 0.04)',
                  minHeight: { xs: 'auto', md: 72 },
                  display: 'grid',
                  gridTemplateColumns: {
                    xs: '1fr',
                    md: gridTemplate,
                  },
                  alignItems: 'center',
                  px: { xs: 1.5, md: 2 },
                  py: { xs: 1.5, md: 1 },
                  gap: { xs: 1.5, md: 0 },
                }}
              >
                {/* Клиент */}
                <Box
                  sx={{
                    pr: { md: 2 },
                    borderRight: { md: `1px solid ${colors.divider}` },
                    minWidth: 0,
                  }}
                >
                  <ClientNameLink
                    clientId={client.id}
                    client={client}
                    sx={{
                      fontWeight: 600,
                      fontSize: typography.label,
                      color: colors.text,
                      lineHeight: 1.25,
                      wordBreak: 'break-word',
                      display: 'block',
                      mb: 0.5,
                      '&:hover': {
                        color: colors.primary,
                      },
                    }}
                  />
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.25, minWidth: 0 }}>
                    <DesignIcon category="ui" name="phone" size={14} />
                    <Typography
                      sx={{
                        fontSize: typography.hint,
                        color: colors.primary,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {client.phone || '—'}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
                    <DesignIcon category="ui" name="email" size={14} />
                    <Typography
                      sx={{
                        fontSize: typography.hint,
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

                {/* Аккаунт */}
                <Box
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 0.75,
                    px: { md: 1 },
                    borderRight: { md: `1px solid ${colors.divider}` },
                  }}
                >
                  <Box
                    sx={{
                      bgcolor: accountStatusColor(client),
                      color: colors.white,
                      px: 1.25,
                      py: 0.35,
                      borderRadius: '10px',
                      fontWeight: 600,
                      fontSize: typography.hint,
                      whiteSpace: 'nowrap',
                      lineHeight: 1.2,
                      textAlign: 'center',
                    }}
                  >
                    {accountStatusLabel(client)}
                  </Box>
                  {client.hasPassword && !client.isAccountApproved && (
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', justifyContent: 'center' }}>
                      <ButtonBase
                        onClick={() => onApproveAccount?.(client)}
                        sx={{
                          bgcolor: colors.success,
                          color: colors.white,
                          px: 1,
                          py: 0.35,
                          borderRadius: '8px',
                          fontWeight: 600,
                          fontSize: 11,
                        }}
                      >
                        Подтвердить
                      </ButtonBase>
                      <ButtonBase
                        onClick={() => onRejectAccount?.(client)}
                        sx={{
                          bgcolor: SOFT_DANGER,
                          color: colors.white,
                          px: 1,
                          py: 0.35,
                          borderRadius: '8px',
                          fontWeight: 600,
                          fontSize: 11,
                        }}
                      >
                        Отклонить
                      </ButtonBase>
                    </Box>
                  )}
                </Box>

                {/* Группа */}
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'center',
                    px: { md: 1 },
                    borderRight: { md: `1px solid ${colors.divider}` },
                  }}
                >
                  <ButtonBase
                    onClick={() => onGroupClick?.(client)}
                    disabled={!onGroupClick}
                    sx={{
                      bgcolor: colors.primarySoft,
                      color: colors.primary,
                      px: 1.5,
                      py: 0.5,
                      borderRadius: '10px',
                      fontWeight: 600,
                      fontSize: typography.hint,
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
                        maxWidth: 160,
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
                    px: { md: 1 },
                    borderRight: { md: `1px solid ${colors.divider}` },
                  }}
                >
                  <Typography
                    sx={{
                      fontWeight: 600,
                      fontSize: typography.label,
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
                    gap: 0.5,
                    pl: { md: 1 },
                    flexWrap: 'wrap',
                  }}
                >
                  <ButtonBase
                    onClick={() => onEdit(client)}
                    sx={{
                      bgcolor: colors.primarySoft,
                      color: colors.text,
                      px: 1.25,
                      py: 0.4,
                      borderRadius: '10px',
                      fontWeight: 600,
                      fontSize: typography.hint,
                      minWidth: 96,
                    }}
                  >
                    Редактировать
                  </ButtonBase>
                  <ButtonBase
                    onClick={() => onDelete(client.id)}
                    sx={{
                      bgcolor: SOFT_DANGER,
                      color: colors.white,
                      px: 1.25,
                      py: 0.4,
                      borderRadius: '10px',
                      fontWeight: 600,
                      fontSize: typography.hint,
                      minWidth: 96,
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
