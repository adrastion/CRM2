import React from 'react';
import { Box, Typography } from '@mui/material';
import { PublicAccount } from '../../types';
import OrgSelect, { OrgOption } from './OrgSelect';
import AuthButton from './AuthButton';
import { colors, radii, typography } from '../../theme/tokens';

interface AccountSelectProps {
  clientAccounts: PublicAccount[];
  staffAccounts: PublicAccount[];
  loading?: boolean;
  error?: string;
  onSubmit: (account: PublicAccount) => void;
  onBack: () => void;
}

/** Человекочитаемая подпись роли сотрудника. */
const ROLE_LABELS: Record<string, string> = {
  OWNER: 'Владелец',
  ADMIN: 'Администратор',
  TRAINER: 'Тренер',
  SUPPORT: 'Техподдержка',
  DESIGNER: 'Дизайнер',
  SECURITY: 'Безопасность',
  MARKETER: 'Маркетолог',
  MEDIA_PARTNER: 'Медиапартнёр',
};

function accountLabel(a: PublicAccount): string {
  return a.tenant?.name || a.displayName;
}

function accountSecondary(a: PublicAccount): string | undefined {
  const parts: string[] = [];

  if (a.accountType === 'PARENT') {
    parts.push(a.childName ? `Родитель · ${a.childName}` : 'Родитель');
  } else if (a.accountType === 'CLIENT') {
    parts.push('Ученик');
  } else if (a.accountType === 'MARKETER') {
    parts.push(ROLE_LABELS[a.role || ''] || 'Маркетолог');
  } else if (a.accountType === 'PROMO_CODE_ADMIN') {
    parts.push('Админ промокодов');
  } else if (a.accountType === 'SUPER_ADMIN') {
    parts.push('Супер-администратор');
  } else if (a.accountType === 'PLATFORM_STAFF') {
    parts.push(ROLE_LABELS[a.role || ''] || 'Персонал платформы');
  } else if (a.role) {
    parts.push(ROLE_LABELS[a.role] || a.role);
  }

  if (a.accountType === 'CLIENT' || a.accountType === 'PARENT') {
    parts.push(a.isAccountApproved ? 'Подтверждён' : 'Ожидает подтверждения');
  }

  return parts.join(' · ') || undefined;
}

function toOptions(accounts: PublicAccount[]): OrgOption[] {
  return accounts.map((a) => ({
    value: `${a.accountType}:${a.id}`,
    label: accountLabel(a),
    secondary: accountSecondary(a),
  }));
}

/** Одна колонка выбора: заголовок, список, кнопка. */
const SelectColumn: React.FC<{
  heading?: string;
  accounts: PublicAccount[];
  loading?: boolean;
  onSubmit: (a: PublicAccount) => void;
}> = ({ heading, accounts, loading, onSubmit }) => {
  const [value, setValue] = React.useState<string | null>(
    accounts.length > 0 ? `${accounts[0].accountType}:${accounts[0].id}` : null
  );
  const [localError, setLocalError] = React.useState('');

  const options = React.useMemo(() => toOptions(accounts), [accounts]);

  const submit = () => {
    const account = accounts.find((a) => `${a.accountType}:${a.id}` === value);
    if (!account) {
      setLocalError('Выберите организацию');
      return;
    }
    setLocalError('');
    onSubmit(account);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 2.5, md: 4 } }}>
      {heading && (
        <Typography
          sx={{
            fontSize: typography.sectionTitle,
            fontWeight: 600,
            color: colors.text,
            lineHeight: 1.2,
          }}
        >
          {heading}
        </Typography>
      )}

      <OrgSelect options={options} value={value} onChange={setValue} />

      {localError && (
        <Typography sx={{ color: colors.danger, fontSize: typography.hint, ml: 2 }}>
          {localError}
        </Typography>
      )}

      <Box sx={{ display: 'flex', justifyContent: 'center', pt: { xs: 0, md: 1 } }}>
        <AuthButton onClick={submit} loading={loading}>
          Войти
        </AuthButton>
      </Box>
    </Box>
  );
};

/**
 * Экран выбора аккаунта при входе.
 *
 * Три конфигурации из макета:
 * — только клиентские аккаунты (ученик/родитель) — одна колонка;
 * — только аккаунты сотрудников — одна колонка;
 * — и те, и другие — две карточки рядом.
 */
const AccountSelect: React.FC<AccountSelectProps> = ({
  clientAccounts,
  staffAccounts,
  loading,
  error,
  onSubmit,
  onBack,
}) => {
  const hasClients = clientAccounts.length > 0;
  const hasStaff = staffAccounts.length > 0;
  const isMixed = hasClients && hasStaff;

  const backLink = (
    <Box sx={{ textAlign: 'center', pt: 2 }}>
      <Typography
        component="button"
        type="button"
        onClick={onBack}
        sx={{
          border: 'none',
          background: 'none',
          cursor: 'pointer',
          fontFamily: 'inherit',
          color: colors.textHint,
          fontSize: typography.hint,
          '&:hover': { textDecoration: 'underline' },
        }}
      >
        Войти под другим аккаунтом
      </Typography>
    </Box>
  );

  const errorBanner = error ? (
    <Typography
      role="alert"
      sx={{ color: colors.danger, fontSize: typography.label, textAlign: 'center' }}
    >
      {error}
    </Typography>
  ) : null;

  if (isMixed) {
    return (
      <Box>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
            gap: { xs: 3, md: 4 },
          }}
        >
          <Box
            sx={{
              bgcolor: colors.surface,
              borderRadius: `${radii.card}px`,
              px: { xs: 2, md: 3 },
              py: { xs: 2.5, md: 3.5 },
            }}
          >
            <SelectColumn
              heading="Войти в аккаунт как клиент"
              accounts={clientAccounts}
              loading={loading}
              onSubmit={onSubmit}
            />
          </Box>
          <Box
            sx={{
              bgcolor: colors.surface,
              borderRadius: `${radii.card}px`,
              px: { xs: 2, md: 3 },
              py: { xs: 2.5, md: 3.5 },
            }}
          >
            <SelectColumn
              heading="Войти в аккаунт как Сотрудник"
              accounts={staffAccounts}
              loading={loading}
              onSubmit={onSubmit}
            />
          </Box>
        </Box>
        {errorBanner}
        {backLink}
      </Box>
    );
  }

  return (
    <Box>
      <SelectColumn
        heading="В аккаунт какой организации вы хотите войти?"
        accounts={hasClients ? clientAccounts : staffAccounts}
        loading={loading}
        onSubmit={onSubmit}
      />
      {errorBanner}
      {backLink}
    </Box>
  );
};

export default AccountSelect;
