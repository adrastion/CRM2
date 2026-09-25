import React from 'react';
import { Box, Button, Divider, List, ListItemButton, ListItemText, Stack, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import BrandLogo from '../components/common/BrandLogo';
import { colors, typography } from '../theme/tokens';
import {
  canSwitchToSavedAccount,
  getActiveAccountId,
  listUsableSavedAccounts,
  SavedAccountSlot,
  switchToAccountSafe,
} from '../utils/accountSwitcher';
import { clearAllAuthStorage } from '../utils/authSession';

type Props = {
  message?: string;
  mode?: 'maintenance' | 'testing' | 'closed_testing';
};

/**
 * Полноэкранная заглушка режима технических работ / тестирования.
 * Показывает список сохранённых аккаунтов, чтобы можно было вернуться на SA
 * или на разрешённый тестовый аккаунт.
 */
const Maintenance: React.FC<Props> = ({
  message = 'На сайте сейчас технические работы. Сервис временно недоступен. Попробуйте позже.',
  mode = 'maintenance',
}) => {
  const navigate = useNavigate();
  const [accounts, setAccounts] = React.useState<SavedAccountSlot[]>([]);
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [slotAccess, setSlotAccess] = React.useState<Record<string, boolean>>({});
  const [switchingId, setSwitchingId] = React.useState<string | null>(null);

  React.useEffect(() => {
    const list = listUsableSavedAccounts();
    setAccounts(list);
    setActiveId(getActiveAccountId());

    let cancelled = false;
    void (async () => {
      const next: Record<string, boolean> = {};
      await Promise.all(
        list.map(async (account) => {
          next[account.id] = await canSwitchToSavedAccount(account);
        })
      );
      if (!cancelled) setSlotAccess(next);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const availableAccounts = accounts.filter(
    (a) => a.accountType === 'SUPER_ADMIN' || slotAccess[a.id] === true
  );
  const blockedAccounts = accounts.filter(
    (a) => a.accountType !== 'SUPER_ADMIN' && slotAccess[a.id] !== true
  );

  const title =
    mode === 'closed_testing'
      ? 'Закрытое тестирование'
      : mode === 'testing'
        ? 'Режим тестирования'
        : 'Технические работы';
  const showLoginButton = mode !== 'closed_testing';
  const loginLabel =
    mode === 'testing' ? 'Войти разрешённым аккаунтом' : 'Вход для администратора';
  const blockedHint =
    mode === 'closed_testing' || mode === 'testing'
      ? 'Остальные аккаунты недоступны (нет в списке тестирования)'
      : 'Другие аккаунты сейчас недоступны';

  const onSwitch = async (id: string) => {
    setSwitchingId(id);
    const result = await switchToAccountSafe(id);
    if (result !== 'ok') setSwitchingId(null);
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        px: 3,
        py: 6,
        pb: { xs: 14, sm: 10 },
        bgcolor: colors.surface,
        backgroundImage: `linear-gradient(160deg, ${colors.surface} 0%, ${colors.primarySoft} 55%, ${colors.surface} 100%)`,
      }}
    >
      <BrandLogo size={56} />
      <Typography
        component="h1"
        sx={{
          mt: 4,
          fontSize: { xs: '1.5rem', sm: '1.85rem' },
          fontWeight: 700,
          color: colors.text,
          textAlign: 'center',
          maxWidth: 520,
        }}
      >
        {title}
      </Typography>
      <Typography
        sx={{
          mt: 1.5,
          fontSize: typography.label,
          color: colors.textMuted,
          textAlign: 'center',
          maxWidth: 440,
          lineHeight: 1.5,
        }}
      >
        {message}
      </Typography>

      {availableAccounts.length > 0 && (
        <Box
          sx={{
            mt: 4,
            width: '100%',
            maxWidth: 400,
            bgcolor: colors.card,
            borderRadius: 2,
            border: `1px solid ${colors.divider}`,
            overflow: 'hidden',
          }}
        >
          <Typography
            sx={{
              px: 2,
              pt: 1.5,
              pb: 0.5,
              fontSize: typography.hint,
              color: colors.textHint,
              fontWeight: 600,
            }}
          >
            Доступные аккаунты
          </Typography>
          <List dense disablePadding>
            {availableAccounts.map((account) => {
              const isActive = account.id === activeId;
              return (
                <ListItemButton
                  key={account.id}
                  disabled={isActive || switchingId === account.id}
                  onClick={() => void onSwitch(account.id)}
                >
                  <ListItemText
                    primary={account.displayName}
                    secondary={account.subtitle || undefined}
                    primaryTypographyProps={{ fontWeight: isActive ? 700 : 600 }}
                  />
                </ListItemButton>
              );
            })}
          </List>
        </Box>
      )}

      {blockedAccounts.length > 0 && (
        <Box sx={{ mt: 2, width: '100%', maxWidth: 400 }}>
          <Typography
            sx={{
              px: 0.5,
              mb: 0.5,
              fontSize: typography.hint,
              color: colors.textHint,
            }}
          >
            {blockedHint}
          </Typography>
          <List
            dense
            disablePadding
            sx={{
              bgcolor: colors.card,
              borderRadius: 2,
              border: `1px solid ${colors.divider}`,
              opacity: 0.7,
            }}
          >
            {blockedAccounts.map((account) => (
              <ListItemButton key={account.id} disabled>
                <ListItemText
                  primary={account.displayName}
                  secondary={account.subtitle || undefined}
                />
              </ListItemButton>
            ))}
          </List>
        </Box>
      )}

      {accounts.length > 0 && <Divider sx={{ my: 3, width: '100%', maxWidth: 400 }} />}

      <Stack spacing={0.5} sx={{ mt: accounts.length === 0 ? 4 : 0, alignItems: 'center' }}>
        {showLoginButton && (
          <Button
            variant="text"
            onClick={() => {
              clearAllAuthStorage();
              navigate('/auth');
            }}
            sx={{ textTransform: 'none', color: colors.primary }}
          >
            {loginLabel}
          </Button>
        )}
        <Button
          variant="text"
          onClick={() => navigate('/terms')}
          sx={{ textTransform: 'none', color: colors.textMuted }}
        >
          Пользовательское соглашение
        </Button>
        <Button
          variant="text"
          onClick={() => navigate('/privacy')}
          sx={{ textTransform: 'none', color: colors.textMuted }}
        >
          Политика конфиденциальности
        </Button>
      </Stack>
    </Box>
  );
};

export default Maintenance;
