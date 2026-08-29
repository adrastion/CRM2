import React from 'react';
import { Box, Typography } from '@mui/material';
import { PhoneIphone, MailOutline, LockOutlined, LockReset } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../services/api';
import {
  IdentifierType,
  PublicAccount,
  UnifiedLoginResponse,
  UnifiedSelectionRequired,
} from '../types';
import {
  applyUnifiedSession,
  clearAllAuthStorage,
  currentSessionDestination,
  extractApiError,
  hasAnySession,
} from '../utils/authSession';
import AuthShell from '../components/auth/AuthShell';
import AuthButton from '../components/auth/AuthButton';
import PillField from '../components/auth/PillField';
import StepTransition from '../components/auth/StepTransition';
import TermsCheckbox from '../components/auth/TermsCheckbox';
import AccountSelect from '../components/auth/AccountSelect';
import { colors, typography } from '../theme/tokens';

/** Шаги единой авторизации. */
type Step = 'identify' | 'setup' | 'password' | 'select';

const STEP_ORDER: Record<Step, number> = { identify: 0, setup: 1, password: 1, select: 2 };

/** Маска телефона в формате +7 (999) 999-99-99. */
function maskPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  const body = digits.startsWith('7') || digits.startsWith('8') ? digits.slice(1) : digits;
  const d = body.slice(0, 10);
  if (!d) return '';
  let out = '+7';
  if (d.length > 0) out += ` (${d.slice(0, 3)}`;
  if (d.length >= 3) out += ')';
  if (d.length > 3) out += ` ${d.slice(3, 6)}`;
  if (d.length > 6) out += `-${d.slice(6, 8)}`;
  if (d.length > 8) out += `-${d.slice(8, 10)}`;
  return out;
}

const Auth: React.FC = () => {
  const navigate = useNavigate();

  const [step, setStep] = React.useState<Step>('identify');
  const [prevStepIndex, setPrevStepIndex] = React.useState(0);

  const [phone, setPhone] = React.useState('');
  const [email, setEmail] = React.useState('');
  /** Каким полем пользователь вошёл — это поле остаётся на следующих экранах. */
  const [identifierType, setIdentifierType] = React.useState<IdentifierType>('phone');
  /** Нормализованное значение, которое отправляем на сервер. */
  const [identifier, setIdentifier] = React.useState('');

  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [acceptTerms, setAcceptTerms] = React.useState(false);
  const [rememberMe, setRememberMe] = React.useState(false);

  const [selection, setSelection] = React.useState<UnifiedSelectionRequired | null>(null);

  const [loading, setLoading] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [notice, setNotice] = React.useState('');

  // Если уже есть активная сессия — сразу уводим в нужный кабинет.
  React.useEffect(() => {
    if (hasAnySession()) {
      const dest = currentSessionDestination();
      if (dest) navigate(dest, { replace: true });
    }
  }, [navigate]);

  const goToStep = (next: Step) => {
    setPrevStepIndex(STEP_ORDER[step]);
    setStep(next);
  };

  const direction: 'forward' | 'back' =
    STEP_ORDER[step] >= prevStepIndex ? 'forward' : 'back';

  const identifierDisplay =
    identifierType === 'phone' ? phone || maskPhone(identifier) : email || identifier;

  const applySession = (result: UnifiedLoginResponse) => {
    if (result.requiresSelection) {
      setSelection(result);
      goToStep('select');
      return;
    }
    const dest = applyUnifiedSession(result);
    window.location.assign(dest);
  };

  const handleError = (err: unknown, defaultField?: string) => {
    const { message, field, status } = extractApiError(err);
    // 409 приходит, когда пароля ещё нет — уводим на создание пароля.
    if (status === 409) {
      setErrors({});
      goToStep('setup');
      setNotice('Пароль ещё не создан. Придумайте пароль для входа.');
      return;
    }
    setErrors({ [field || defaultField || 'form']: message });
  };

  /* ------------------------- Шаг 1: идентификация ------------------------- */

  const submitIdentify = async () => {
    setErrors({});
    setNotice('');

    const usePhone = phone.trim().length > 0;
    const useEmail = email.trim().length > 0;

    if (!usePhone && !useEmail) {
      setErrors({ form: 'Введите номер телефона или email' });
      return;
    }
    if (usePhone && useEmail) {
      setErrors({ form: 'Заполните только одно поле — телефон или email' });
      return;
    }

    const raw = usePhone ? phone : email;
    const type: IdentifierType = usePhone ? 'phone' : 'email';

    setLoading(true);
    try {
      clearAllAuthStorage();
      const result = await apiService.identify(raw);
      setIdentifierType(result.identifierType);
      setIdentifier(result.identifier);
      setPassword('');
      setConfirmPassword('');
      goToStep(result.needsPasswordSetup ? 'setup' : 'password');
    } catch (err) {
      handleError(err, type === 'phone' ? 'phone' : 'email');
    } finally {
      setLoading(false);
    }
  };

  /* --------------------- Шаг 2а: создание пароля -------------------------- */

  const submitSetupPassword = async () => {
    setErrors({});
    const next: Record<string, string> = {};

    if (password.length < 6) next.password = 'Пароль должен содержать минимум 6 символов';
    if (confirmPassword !== password) next.confirmPassword = 'Пароли не совпадают';
    if (!acceptTerms) next.acceptTerms = 'Необходимо принять условия соглашения';

    if (Object.keys(next).length > 0) {
      setErrors(next);
      return;
    }

    setLoading(true);
    try {
      const result = await apiService.setupPassword({
        identifier,
        password,
        confirmPassword,
        acceptTerms,
        rememberMe,
      });
      applySession(result);
    } catch (err) {
      handleError(err, 'password');
    } finally {
      setLoading(false);
    }
  };

  /* ----------------------- Шаг 2б: вход по паролю ------------------------- */

  const submitLogin = async () => {
    setErrors({});
    if (!password) {
      setErrors({ password: 'Введите пароль' });
      return;
    }

    setLoading(true);
    try {
      const result = await apiService.unifiedLogin({ identifier, password, rememberMe });
      applySession(result);
    } catch (err) {
      handleError(err, 'password');
    } finally {
      setLoading(false);
    }
  };

  /* ------------------- Шаг 3: выбор организации/роли ---------------------- */

  const submitSelection = async (account: PublicAccount) => {
    if (!selection) return;
    setErrors({});
    setLoading(true);
    try {
      const session = await apiService.selectAccount({
        selectionToken: selection.selectionToken,
        accountType: account.accountType,
        accountId: account.id,
      });
      const dest = applyUnifiedSession(session);
      window.location.assign(dest);
    } catch (err) {
      handleError(err, 'form');
    } finally {
      setLoading(false);
    }
  };

  const restart = () => {
    setSelection(null);
    setPassword('');
    setConfirmPassword('');
    setAcceptTerms(false);
    setErrors({});
    setNotice('');
    goToStep('identify');
  };

  /* ------------------------------ Разметка ------------------------------- */

  const formError = errors.form;

  const identifierFieldForNextSteps = (
    <PillField
      name="identifier"
      icon={identifierType === 'phone' ? <PhoneIphone /> : <MailOutline />}
      placeholder={identifierType === 'phone' ? '+7 (999) 999-99-99' : 'Email'}
      value={identifierDisplay}
      onChange={() => undefined}
      readOnly
    />
  );

  const errorBanner = formError ? (
    <Box
      role="alert"
      sx={{
        bgcolor: `${colors.danger}14`,
        border: `1px solid ${colors.danger}`,
        borderRadius: '14px',
        px: 2.5,
        py: 1.5,
      }}
    >
      <Typography sx={{ color: colors.danger, fontSize: typography.label }}>{formError}</Typography>
    </Box>
  ) : null;

  const noticeBanner = notice ? (
    <Typography sx={{ color: colors.textMuted, fontSize: typography.label, textAlign: 'center' }}>
      {notice}
    </Typography>
  ) : null;

  /* ---- Шаг 1 ---- */
  const identifyStep = (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 2.5, md: 3.5 } }}>
      <Typography
        sx={{
          color: colors.danger,
          fontSize: typography.hint,
          textAlign: 'left',
          lineHeight: 1.5,
        }}
      >
        *Чтобы войти в аккаунт, необходимо, чтобы номер или email были в базе спортивной школы
      </Typography>

      <PillField
        name="phone"
        icon={<PhoneIphone />}
        placeholder="Телефон"
        type="tel"
        autoComplete="tel"
        value={phone}
        onChange={(v) => setPhone(maskPhone(v))}
        error={errors.phone}
        onEnter={submitIdentify}
      />

      <Typography
        sx={{
          textAlign: 'center',
          color: colors.primary,
          fontSize: typography.sectionTitle,
          fontWeight: 600,
          lineHeight: 1,
        }}
      >
        или
      </Typography>

      <PillField
        name="email"
        icon={<MailOutline />}
        placeholder="Email"
        type="email"
        autoComplete="email"
        value={email}
        onChange={(v) => setEmail(v.toLowerCase())}
        error={errors.email}
        onEnter={submitIdentify}
      />

      {errorBanner}

      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 2,
          justifyContent: 'center',
          pt: { xs: 1, md: 2 },
        }}
      >
        <AuthButton onClick={submitIdentify} loading={loading}>
          Войти
        </AuthButton>
        <AuthButton variant="dark" onClick={() => navigate('/partner/register')}>
          Стать партнером
        </AuthButton>
      </Box>
    </Box>
  );

  /* ---- Шаг 2а ---- */
  const setupStep = (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 2.5, md: 3 } }}>
      {identifierFieldForNextSteps}

      <PillField
        name="new-password"
        icon={<LockOutlined />}
        placeholder="Придумайте пароль"
        type="password"
        autoComplete="new-password"
        autoFocus
        revealable
        value={password}
        onChange={setPassword}
        error={errors.password}
        hint="Минимум 6 символов"
        onEnter={submitSetupPassword}
      />

      <PillField
        name="confirm-password"
        icon={<LockReset />}
        placeholder="Подтвердите пароль"
        type="password"
        autoComplete="new-password"
        revealable
        value={confirmPassword}
        onChange={setConfirmPassword}
        error={errors.confirmPassword}
        onEnter={submitSetupPassword}
      />

      <TermsCheckbox
        checked={acceptTerms}
        onChange={setAcceptTerms}
        error={Boolean(errors.acceptTerms)}
      />
      {errors.acceptTerms && (
        <Typography sx={{ color: colors.danger, fontSize: typography.hint, ml: 4.5 }}>
          {errors.acceptTerms}
        </Typography>
      )}

      {errorBanner}
      {noticeBanner}

      <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, pt: { xs: 1, md: 2 } }}>
        <AuthButton onClick={submitSetupPassword} loading={loading}>
          Войти
        </AuthButton>
      </Box>

      <Box sx={{ textAlign: 'center' }}>
        <Typography
          component="button"
          type="button"
          onClick={restart}
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
          Изменить {identifierType === 'phone' ? 'номер' : 'email'}
        </Typography>
      </Box>
    </Box>
  );

  /* ---- Шаг 2б ---- */
  const passwordStep = (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 2.5, md: 3 } }}>
      {identifierFieldForNextSteps}

      <PillField
        name="password"
        icon={<LockOutlined />}
        placeholder="Введите пароль"
        type="password"
        autoComplete="current-password"
        autoFocus
        revealable
        value={password}
        onChange={setPassword}
        error={errors.password}
        onEnter={submitLogin}
      />

      <TermsCheckbox checked={rememberMe} onChange={setRememberMe} label="Запомнить меня" />

      {errorBanner}

      <Box sx={{ display: 'flex', justifyContent: 'center', pt: { xs: 1, md: 2 } }}>
        <AuthButton onClick={submitLogin} loading={loading}>
          Войти
        </AuthButton>
      </Box>

      <Box sx={{ textAlign: 'center' }}>
        <Typography
          component="button"
          type="button"
          onClick={restart}
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
          Изменить {identifierType === 'phone' ? 'номер' : 'email'}
        </Typography>
      </Box>
    </Box>
  );

  /* ---- Шаг 3 ---- */
  const hasClients = (selection?.clientAccounts.length || 0) > 0;
  const hasStaff = (selection?.staffAccounts.length || 0) > 0;
  const isMixed = hasClients && hasStaff;

  const selectStep = selection ? (
    <AccountSelect
      clientAccounts={selection.clientAccounts}
      staffAccounts={selection.staffAccounts}
      loading={loading}
      error={formError}
      onSubmit={submitSelection}
      onBack={restart}
    />
  ) : null;

  /* ---- Заголовок и ширина в зависимости от шага ---- */
  let title = 'Вход в личный кабинет';
  let titleSecondLine: string | undefined;
  let width: 'auth' | 'select' | 'full' = 'auth';

  if (step === 'select') {
    if (isMixed) {
      width = 'full';
    } else {
      width = 'select';
      if (hasStaff && !hasClients) titleSecondLine = 'Сотрудника';
    }
  }

  const content =
    step === 'identify'
      ? identifyStep
      : step === 'setup'
      ? setupStep
      : step === 'password'
      ? passwordStep
      : selectStep;

  return (
    <AuthShell
      title={title}
      titleSecondLine={titleSecondLine}
      width={width}
      card={step !== 'select' || !isMixed}
    >
      <StepTransition stepKey={step} direction={direction}>
        {content}
      </StepTransition>
    </AuthShell>
  );
};

export default Auth;
