import React from 'react';
import { Box, Typography, InputBase, ButtonBase, Link as MuiLink } from '@mui/material';
import { Client } from '../../types';
import { colors, radii, typography } from '../../theme/tokens';
import ClientNameLink from '../ClientNameLink';
import DesignIcon from '../common/DesignIcon';
import {
  clientAccountStatusLabel,
  getClientAccountStatus,
} from '../../utils/clientAccountStatus';

const SOFT_DANGER = '#EC7C94';

/** Пастельные акценты строк списка (макет 05). */
const PASTEL_ROW = ['#EEF4FF', '#F3EEFF', '#EEF9F6', '#FFF4F0', '#F5F6FA'] as const;

const membershipStatusChip = (
  client: Client
): { label: string; bg: string; fg: string } => {
  const m = client.activeMembership;
  if (!m) {
    return { label: 'Нет абонемента', bg: 'rgba(249, 60, 101, 0.12)', fg: colors.danger };
  }
  if (m.remaining != null && m.remaining <= 0) {
    return {
      label: m.remaining < 0 ? `Долг ${Math.abs(m.remaining)}` : 'Нет занятий',
      bg: 'rgba(249, 60, 101, 0.12)',
      fg: colors.danger,
    };
  }
  if (m.remaining != null && m.remaining <= 3) {
    return {
      label: `Осталось ${m.remaining}`,
      bg: 'rgba(237, 108, 2, 0.14)',
      fg: '#C45A00',
    };
  }
  return { label: 'Активен', bg: 'rgba(0, 182, 155, 0.14)', fg: colors.success };
};

export interface ClientsListProps {
  clients: Client[];
  searchQuery: string;
  onSearchChange: (value: string) => void;
  sortBy: string;
  onSort: (key: string) => void;
  onEdit: (client: Client) => void;
  onDelete?: (clientId: string) => void;
  onGroupClick?: (client: Client) => void;
  onMembershipClick?: (client: Client) => void;
  onApproveAccount?: (client: Client) => void;
  onRejectAccount?: (client: Client) => void;
  /** Доп. действия (добавить / импорт / экспорт) — вне макета, но нужны в продукте. */
  toolbarActions?: React.ReactNode;
}

/** Как formatMoney на вкладке Финансы — без принудительного округления до целых. */
const formatBalance = (value?: number) => {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return '0 ₽';
  const abs = Math.abs(n).toLocaleString('ru-RU');
  return n < 0 ? `−${abs} ₽` : `${abs} ₽`;
};

const primaryGroupName = (client: Client): string => {
  const active = (client.groupMemberships || []).filter((gm: any) => gm.isActive);
  if (active.length === 0) return '—';
  return active
    .map((gm: any) => {
      const name = gm.group?.name || 'Группа';
      return gm.isTrial ? `${name} (пробное)` : name;
    })
    .join(', ');
};

const membershipChipLabel = (client: Client): { title: string; remaining: number | null } => {
  const m = client.activeMembership;
  if (!m) return { title: '—', remaining: null };
  return { title: m.name, remaining: m.remaining };
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
const accountStatusLabel = (client: Client): string =>
  clientAccountStatusLabel(getClientAccountStatus(client));

const accountStatusColor = (client: Client): string => {
  const status = getClientAccountStatus(client);
  if (status === 'lead') return '#7B6CF6';
  if (status === 'unregistered') return colors.textHint;
  if (status === 'pending') return '#ED6C02';
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
  onMembershipClick,
  onApproveAccount,
  onRejectAccount,
  toolbarActions,
}) => {
  const toggleSort = (key: string) => {
    onSort(key);
  };

  const gridTemplate =
    'minmax(180px, 1.2fr) minmax(150px, 1fr) minmax(110px, 0.8fr) minmax(130px, 0.95fr) minmax(80px, 0.5fr) minmax(110px, 0.55fr)';

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
            borderRadius: `${radii.panel}px`,
            border: `1px solid ${colors.primarySoft}`,
            bgcolor: colors.card,
            minHeight: 44,
            boxShadow: '0 1px 4px rgba(47, 107, 255, 0.06)',
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
          <SortHeader label="Абонемент" active={false} sortable={false} center />
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
              borderRadius: `${radii.panel}px`,
              py: 4,
              textAlign: 'center',
            }}
          >
            <Typography sx={{ color: colors.textEmpty, fontSize: typography.label }}>
              Клиенты не найдены
            </Typography>
          </Box>
        ) : (
          clients.map((client, index) => {
            const groupName = primaryGroupName(client);
            const membership = membershipChipLabel(client);
            const remainingNeg =
              membership.remaining != null && membership.remaining < 0;
            const statusChip = membershipStatusChip(client);
            const pastel = PASTEL_ROW[index % PASTEL_ROW.length];
            return (
              <Box
                key={client.id}
                sx={{
                  bgcolor: { xs: pastel, md: colors.card },
                  borderRadius: `${radii.panel}px`,
                  boxShadow: '0 2px 10px rgba(32, 34, 36, 0.05)',
                  minHeight: { xs: 'auto', md: 72 },
                  display: 'grid',
                  gridTemplateColumns: {
                    xs: '1fr',
                    md: gridTemplate,
                  },
                  alignItems: 'center',
                  px: { xs: 1.75, md: 2 },
                  py: { xs: 1.75, md: 1 },
                  gap: { xs: 1.25, md: 0 },
                  border: { xs: 'none', md: `1px solid ${colors.divider}` },
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
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      gap: 1,
                      mb: 0.5,
                    }}
                  >
                    <ClientNameLink
                      clientId={client.id}
                      client={client}
                      onOpen={() => onEdit(client)}
                      sx={{
                        fontWeight: 700,
                        fontSize: { xs: 15, md: typography.label },
                        color: colors.text,
                        lineHeight: 1.25,
                        wordBreak: 'break-word',
                        display: 'block',
                        '&:hover': {
                          color: colors.primary,
                        },
                      }}
                    />
                    {/* Мобильный чип статуса абонемента (макет 05) */}
                    <Box
                      sx={{
                        display: { xs: 'inline-flex', md: 'none' },
                        flexShrink: 0,
                        bgcolor: statusChip.bg,
                        color: statusChip.fg,
                        px: 1,
                        py: 0.35,
                        borderRadius: `${radii.button}px`,
                        fontWeight: 600,
                        fontSize: typography.label,
                        whiteSpace: 'nowrap',
                        lineHeight: 1.2,
                      }}
                    >
                      {statusChip.label}
                    </Box>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.25, minWidth: 0 }}>
                    <DesignIcon category="ui" name="phone" size={14} />
                    {client.phone ? (
                      <MuiLink
                        href={`tel:${client.phone}`}
                        underline="hover"
                        sx={{
                          fontSize: typography.hint,
                          color: colors.primary,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          fontWeight: 500,
                        }}
                      >
                        {client.phone}
                      </MuiLink>
                    ) : (
                      <Typography sx={{ fontSize: typography.hint, color: colors.textHint }}>
                        —
                      </Typography>
                    )}
                  </Box>
                  <Box
                    sx={{
                      display: { xs: 'none', md: 'flex' },
                      alignItems: 'center',
                      gap: 0.75,
                      minWidth: 0,
                    }}
                  >
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
                  {/* Мобилка: группа под контактом */}
                  <Box
                    sx={{
                      display: { xs: 'flex', md: 'none' },
                      alignItems: 'center',
                      gap: 0.75,
                      mt: 0.75,
                      flexWrap: 'wrap',
                    }}
                  >
                    <Box
                      component="button"
                      type="button"
                      onClick={() => onGroupClick?.(client)}
                      disabled={!onGroupClick}
                      sx={{
                        border: 'none',
                        cursor: onGroupClick ? 'pointer' : 'default',
                        bgcolor: colors.card,
                        color: colors.primary,
                        px: 1.25,
                        py: 0.4,
                        borderRadius: `${radii.button}px`,
                        fontWeight: 600,
                        fontSize: typography.label,
                      }}
                    >
                      {groupName}
                    </Box>
                    <Typography sx={{ fontSize: typography.label, fontWeight: 600, color: colors.textMuted }}>
                      {formatBalance(client.balance)}
                    </Typography>
                  </Box>
                </Box>

                {/* Аккаунт */}
                <Box
                  sx={{
                    display: { xs: 'none', md: 'flex' },
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
                          fontSize: typography.label,
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
                          fontSize: typography.label,
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
                    display: { xs: 'none', md: 'flex' },
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

                {/* Абонемент */}
                <Box
                  sx={{
                    display: { xs: 'none', md: 'flex' },
                    justifyContent: 'center',
                    px: { md: 1 },
                    borderRight: { md: `1px solid ${colors.divider}` },
                  }}
                >
                  <ButtonBase
                    onClick={() => onMembershipClick?.(client)}
                    disabled={!onMembershipClick}
                    sx={{
                      bgcolor: remainingNeg ? 'rgba(236, 124, 148, 0.2)' : colors.primarySoft,
                      color: remainingNeg ? SOFT_DANGER : colors.primary,
                      px: 1.5,
                      py: 0.5,
                      borderRadius: '10px',
                      fontWeight: 600,
                      fontSize: typography.hint,
                      textAlign: 'center',
                      maxWidth: '100%',
                      lineHeight: 1.25,
                      flexDirection: 'column',
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
                        maxWidth: 140,
                        display: 'block',
                      }}
                    >
                      {membership.title}
                    </Typography>
                    {membership.remaining != null && (
                      <Typography
                        component="span"
                        sx={{
                          fontWeight: 500,
                          fontSize: typography.label,
                          color: 'inherit',
                          display: 'block',
                        }}
                      >
                        {membership.remaining < 0
                          ? `долг ${Math.abs(membership.remaining)} пос.`
                          : `осталось ${membership.remaining}`}
                      </Typography>
                    )}
                  </ButtonBase>
                </Box>

                {/* Баланс */}
                <Box
                  sx={{
                    display: { xs: 'none', md: 'flex' },
                    justifyContent: 'center',
                    px: { md: 1 },
                    borderRight: { md: `1px solid ${colors.divider}` },
                  }}
                >
                  <Typography
                    sx={{
                      fontWeight: 600,
                      fontSize: typography.label,
                      color:
                        Number(client.balance ?? 0) < 0
                          ? SOFT_DANGER
                          : Number(client.balance ?? 0) > 0
                            ? colors.success
                            : colors.text,
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
                    justifyContent: { xs: 'stretch', md: 'center' },
                    gap: 0.75,
                    pl: { md: 1 },
                    flexWrap: 'wrap',
                    mt: { xs: 0.5, md: 0 },
                  }}
                >
                  <ButtonBase
                    onClick={() => onEdit(client)}
                    sx={{
                      flex: { xs: 1, md: 'none' },
                      bgcolor: colors.primary,
                      color: colors.white,
                      px: 1.5,
                      py: 0.65,
                      borderRadius: `${radii.button}px`,
                      fontWeight: 600,
                      fontSize: typography.hint,
                      minWidth: { xs: 0, md: 96 },
                      '&:hover': { bgcolor: colors.primaryDark },
                    }}
                  >
                    <Box component="span" sx={{ display: { xs: 'inline', md: 'none' } }}>
                      Карточка
                    </Box>
                    <Box component="span" sx={{ display: { xs: 'none', md: 'inline' } }}>
                      Редактировать
                    </Box>
                  </ButtonBase>
                  {client.phone && (
                    <ButtonBase
                      component="a"
                      href={`tel:${client.phone}`}
                      sx={{
                        display: { xs: 'inline-flex', md: 'none' },
                        bgcolor: colors.card,
                        color: colors.primary,
                        px: 1.5,
                        py: 0.65,
                        borderRadius: `${radii.button}px`,
                        fontWeight: 600,
                        fontSize: typography.hint,
                        minWidth: 88,
                        border: `1px solid ${colors.primarySoft}`,
                      }}
                    >
                      Звонок
                    </ButtonBase>
                  )}
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
