import React from 'react';
import { Box, Button, Divider, List, ListItemButton, ListItemText, Typography } from '@mui/material';
import BrandLogo from '../components/common/BrandLogo';
import { colors, typography } from '../theme/tokens';
import {
  getActiveAccountId,
  listSavedAccounts,
  SavedAccountSlot,
  switchToAccount,
} from '../utils/accountSwitcher';

type Props = {
  message?: string;
};

/**
 * Полноэкранная заглушка режима технических работ.
 * Показывает список сохранённых аккаунтов, чтобы можно было вернуться на SA.
 */
const Maintenance: React.FC<Props> = ({
  message = 'На сайте сейчас технические работы. Сервис временно недоступен. Попробуйте позже.',
}) => {
  const [accounts, setAccounts] = React.useState<SavedAccountSlot[]>([]);
  const [activeId, setActiveId] = React.useState<string | null>(null);

  React.useEffect(() => {
    setAccounts(listSavedAccounts().sort((a, b) => b.updatedAt - a.updatedAt));
    setActiveId(getActiveAccountId());
  }, []);

  const saAccounts = accounts.filter((a) => a.accountType === 'SUPER_ADMIN');
  const otherAccounts = accounts.filter((a) => a.accountType !== 'SUPER_ADMIN');

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
        Технические работы
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

      {saAccounts.length > 0 && (
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
            Вернуться к супер-админу
          </Typography>
          <List dense disablePadding>
            {saAccounts.map((account) => {
              const isActive = account.id === activeId;
              return (
                <ListItemButton
                  key={account.id}
                  disabled={isActive}
                  onClick={() => switchToAccount(account.id)}
                >
                  <ListItemText
                    primary={account.displayName}
                    secondary={account.subtitle || 'Супер-админ'}
                    primaryTypographyProps={{ fontWeight: isActive ? 700 : 600 }}
                  />
                </ListItemButton>
              );
            })}
          </List>
        </Box>
      )}

      {otherAccounts.length > 0 && (
        <Box sx={{ mt: 2, width: '100%', maxWidth: 400 }}>
          <Typography
            sx={{
              px: 0.5,
              mb: 0.5,
              fontSize: typography.hint,
              color: colors.textHint,
            }}
          >
            Другие аккаунты сейчас недоступны
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
            {otherAccounts.map((account) => (
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

      <Button
        href="/auth"
        variant="text"
        sx={{ textTransform: 'none', color: colors.primary }}
      >
        Вход для администратора
      </Button>
    </Box>
  );
};

export default Maintenance;
