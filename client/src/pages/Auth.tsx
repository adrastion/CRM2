import React from 'react';
import { Box, Button, Divider, Typography } from '@mui/material';
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
import {
  listUsableSavedAccounts,
  SavedAccountSlot,
  switchToAccountSafe,
} from '../utils/accountSwitcher';
import AuthShell from '../components/auth/AuthShell';
import AuthButton from '../components/auth/AuthButton';
import PillField from '../components/auth/PillField';
import StepTransition from '../components/auth/StepTransition';
import TermsCheckbox from '../components/auth/TermsCheckbox';
import LegalConsentCheckboxes from '../components/auth/LegalConsentCheckboxes';
import AccountSelect from '../components/auth/AccountSelect';
import { colors, typography } from '../theme/tokens';
import { formatContactInput, maskPhoneInput } from '../utils/phone';

/** Шаги единой авторизации. */
type Step =
  | 'identify'
  | 'password'
  | 'setup'
  | 'select'
  | 'email_code'
  | 'twofa_code'
  | 'push_code'
  | 'qr_wait'
  | 'forgot_email'
  | 'forgot_code'
  | 'forgot_select'
  | 'forgot_new_password';

const STEP_ORDER: Record<Step, number> = {
  identify: 0,
  password: 1,
  setup: 2,
  select: 3,
  email_code: 4,
  twofa_code: 5,
  push_code: 6,
  qr_wait: 7,
  forgot_email: 8,
  forgot_code: 9,
  forgot_select: 10,
  forgot_new_password: 11,
};

const Auth: React.FC = () => {
  const navigate = useNavigate();

  const [step, setStep] = React.useState<Step>('identify');
  const [prevStepIndex, setPrevStepIndex] = React.useState(0);

  /** Единое поле email или телефон на экране входа. */
  const [contact, setContact] = React.useState('');
  /** Каким полем пользователь вошёл — для шага setup. */
  const [identifierType, setIdentifierType] = React.useState<IdentifierType>('phone');
  /** Нормализованное значение, которое отправляем на сервер. */
  const [identifier, setIdentifier] = React.useState('');

  const [setupAccounts, setSetupAccounts] = React.useState<PublicAccount[]>([]);
  const [setupAccountId, setSetupAccountId] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [acceptTerms, setAcceptTerms] = React.useState(false);
  const [acceptPrivacy, setAcceptPrivacy] = React.useState(false);
  const [rememberMe, setRememberMe] = React.useState(false);

  const [selection, setSelection] = React.useState<UnifiedSelectionRequired | null>(null);

  const [forgotEmail, setForgotEmail] = React.useState('');
  const [forgotCode, setForgotCode] = React.useState('');
  const [resetToken, setResetToken] = React.useState('');
  const [forgotAccounts, setForgotAccounts] = React.useState<PublicAccount[]>([]);
  const [forgotAccount, setForgotAccount] = React.useState<PublicAccount | null>(null);
  const [forgotNotice, setForgotNotice] = React.useState('');

  const [challengeToken, setChallengeToken] = React.useState('');
  const [loginCode, setLoginCode] = React.useState('');
  const [qrSecret, setQrSecret] = React.useState('');
  const [qrUrl, setQrUrl] = React.useState('');

  const [loading, setLoading] = React.useState(false);
  /** Синхронный гард против дабл-клика до срабатывания setLoading. */
  const setupSubmitLock = React.useRef(false);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [notice, setNotice] = React.useState('');
  const [testingMode, setTestingMode] = React.useState(
    () => sessionStorage.getItem('testingMode') === '1'
  );
  const [savedAccounts, setSavedAccounts] = React.useState<SavedAccountSlot[]>(() =>
    listUsableSavedAccounts()
  );
  const [switchingAccountId, setSwitchingAccountId] = React.useState<string | null>(null);

  // Если уже есть активная сессия — сразу уводим в нужный кабинет.
  // Не уводим при блокировке тестирования/ТО: иначе цикл «заглушка → /auth → кабинет → заглушка».
  React.useEffect(() => {
    const accessBlocked =
      sessionStorage.getItem('maintenanceMode') === '1' ||
      sessionStorage.getItem('closedTestingMode') === '1' ||
      (sessionStorage.getItem('testingMode') === '1' &&
        sessionStorage.getItem('testingModeAccess') !== '1' &&
        !localStorage.getItem('superAdminToken'));
    if (accessBlocked) return;
    if (hasAnySession()) {
      const dest = currentSessionDestination();
      if (dest) navigate(dest, { replace: true });
    }
  }, [navigate]);

  React.useEffect(() => {
    setSavedAccounts(listUsableSavedAccounts());
  }, [step]);

  React.useEffect(() => {
    if (step !== 'qr_wait' || !challengeToken) return;
    let cancelled = false;
    const pull = async () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      try {
        const data = await apiService.getQrLoginStatus(challengeToken);
        if (cancelled) return;
        if (data.status === 'APPROVED' && data.session) {
          applySession(data.session);
        } else if (data.status === 'DENIED') {
          setErrors({ form: 'Вход отклонён на другом устройстве' });
          goToStep('identify');
        }
      } catch {
        /* keep waiting */
      }
    };
    const timer = window.setInterval(pull, 2500);
    void pull();
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, challengeToken]);

  const continueAsSavedAccount = async (account: SavedAccountSlot) => {
    setSwitchingAccountId(account.id);
    setErrors({});
    try {
      const result = await switchToAccountSafe(account.id);
      if (result === 'blocked') {
        setErrors({
          form: 'Этот аккаунт сейчас недоступен (техобслуживание или режим тестирования)',
        });
        return;
      }
      if (result === 'missing' || result === 'invalid') {
        setSavedAccounts(listUsableSavedAccounts());
        setErrors({
          form:
            result === 'invalid'
              ? 'Сессия этого аккаунта истекла — войдите заново'
              : 'Сохранённый аккаунт не найден',
        });
        return;
      }
      // switchToAccountSafe делает full reload при ok
    } catch {
      setErrors({ form: 'Не удалось переключить аккаунт' });
    } finally {
      setSwitchingAccountId(null);
    }
  };

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const status = await apiService.getMaintenanceStatus();
        if (cancelled) return;
        const on = Boolean(status?.testing?.enabled);
        setTestingMode(on);
        if (on) sessionStorage.setItem('testingMode', '1');
        else if (sessionStorage.getItem('testingMode') === '1' && !status?.maintenance?.enabled) {
          sessionStorage.removeItem('testingMode');
        }
      } catch {
        /* keep session flag */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const goToStep = (next: Step) => {
    setPrevStepIndex(STEP_ORDER[step]);
    setStep(next);
  };

  const direction: 'forward' | 'back' =
    STEP_ORDER[step] >= prevStepIndex ? 'forward' : 'back';

  const identifierDisplay =
    identifierType === 'phone'
      ? maskPhoneInput(identifier) || contact
      : identifier || contact;

  const applySession = (result: UnifiedLoginResponse) => {
    if ('requiresEmail2fa' in result) {
      setChallengeToken(result.challengeToken);
      setLoginCode('');
      goToStep('twofa_code');
      setNotice('Введите код из письма для подтверждения входа');
      return;
    }
    if (result.requiresSelection) {
      setSelection(result);
      goToStep('select');
      return;
    }
    const dest = applyUnifiedSession(result);
    window.location.assign(dest);
  };

  const ensureIdentified = async () => {
    const raw = contact.trim();
    if (!raw) {
      setErrors({ contact: 'Введите номер телефона или email' });
      return null;
    }
    const identified = await apiService.identify(raw);
    setIdentifierType(identified.identifierType);
    setIdentifier(identified.identifier);
    return identified.identifier;
  };

  const startEmailCodeLogin = async () => {
    setErrors({});
    setNotice('');
    setLoading(true);
    try {
      clearAllAuthStorage();
      const id = await ensureIdentified();
      if (!id) return;
      const data = await apiService.requestEmailLogin({ identifier: id, rememberMe });
      if (!data.challengeToken) {
        setNotice(data.message || 'Если аккаунт найден, код отправлен на почту');
        return;
      }
      setChallengeToken(data.challengeToken);
      setLoginCode('');
      goToStep('email_code');
      setNotice('Код отправлен на почту');
    } catch (err) {
      handleError(err, 'contact');
    } finally {
      setLoading(false);
    }
  };

  const submitEmailCode = async () => {
    setErrors({});
    if (!/^\d{6}$/.test(loginCode.trim())) {
      setErrors({ code: 'Введите 6-значный код' });
      return;
    }
    setLoading(true);
    try {
      const result =
        step === 'twofa_code'
          ? await apiService.verifyEmail2fa({ challengeToken, code: loginCode.trim() })
          : step === 'push_code'
            ? await apiService.verifyPushLogin({ challengeToken, code: loginCode.trim() })
            : await apiService.verifyEmailLogin({ challengeToken, code: loginCode.trim() });
      applySession(result);
    } catch (err) {
      handleError(err, 'code');
    } finally {
      setLoading(false);
    }
  };

  const startPushLogin = async () => {
    setErrors({});
    setNotice('');
    setLoading(true);
    try {
      clearAllAuthStorage();
      const id = await ensureIdentified();
      if (!id) return;
      const data = await apiService.requestPushLogin({ identifier: id, rememberMe });
      setChallengeToken(data.challengeToken);
      setLoginCode('');
      goToStep('push_code');
      setNotice(data.message || 'Код отправлен на другое устройство');
    } catch (err) {
      handleError(err, 'contact');
    } finally {
      setLoading(false);
    }
  };

  const startQrLogin = async () => {
    setErrors({});
    setNotice('');
    setLoading(true);
    try {
      // Discord-style: почта/телефон не нужны — аккаунт возьмётся с мобильной сессии
      clearAllAuthStorage();
      const data = await apiService.startQrLogin({ rememberMe });
      setChallengeToken(data.challengeToken);
      setQrSecret(data.secret);
      const approveUrl = `${window.location.origin}/auth/device-approve?challenge=${encodeURIComponent(data.challengeToken)}&secret=${encodeURIComponent(data.secret)}`;
      setQrUrl(approveUrl);
      goToStep('qr_wait');
      setNotice('Отсканируйте QR на телефоне, где вы уже вошли в аккаунт');
    } catch (err) {
      handleError(err, 'form');
    } finally {
      setLoading(false);
    }
  };

  const handleError = (err: unknown, defaultField?: string) => {
    const { message, field, status } = extractApiError(err);
    // Пароль уже есть — с формы создания уводим на обычный ввод.
    if (/пароль уже создан/i.test(message)) {
      setErrors({});
      setConfirmPassword('');
      setAcceptTerms(false);
      setAcceptPrivacy(false);
      goToStep('password');
      setNotice('Пароль уже создан. Введите его для входа.');
      return;
    }
    // 409 «Пароль ещё не создан» — экран создания пароля (не любой 409).
    if (status === 409 && /пароль ещё не создан/i.test(message)) {
      setErrors({});
      goToStep('setup');
      setNotice('Пароль ещё не создан. Придумайте пароль для входа.');
      return;
    }
    const mappedField =
      field === 'identifier' || field === 'phone' || field === 'email' ? 'contact' : field;
    setErrors({ [mappedField || defaultField || 'form']: message });
  };

  /* -------------- Шаг 1: только контакт → identify ----------------------- */

  const submitIdentify = async () => {
    setErrors({});
    setNotice('');

    const raw = contact.trim();
    if (!raw) {
      setErrors({ contact: 'Введите номер телефона или email' });
      return;
    }

    setLoading(true);
    try {
      clearAllAuthStorage();
      const identified = await apiService.identify(raw);
      setIdentifierType(identified.identifierType);
      setIdentifier(identified.identifier);
      setPassword('');
      setConfirmPassword('');

      if (identified.needsPasswordSetup) {
        const pending = identified.setupAccounts || [];
        setSetupAccounts(pending);
        setSetupAccountId(pending.length === 1 ? pending[0].id : '');
        setAcceptTerms(false);
        setAcceptPrivacy(false);
        goToStep('setup');
        setNotice(
          pending.length > 1
            ? 'Выберите, для кого создаёте пароль. У спортсмена и родителя пароли разные.'
            : 'Пароль ещё не создан. Придумайте пароль для входа.'
        );
        return;
      }

      goToStep('password');
    } catch (err) {
      handleError(err, 'contact');
    } finally {
      setLoading(false);
    }
  };

  /* -------------- Шаг 2: ввод существующего пароля ----------------------- */

  const submitPasswordLogin = async () => {
    setErrors({});
    setNotice('');

    if (!identifier) {
      setErrors({ form: 'Сначала укажите телефон или email' });
      goToStep('identify');
      return;
    }
    if (!password) {
      setErrors({ password: 'Введите пароль' });
      return;
    }

    setLoading(true);
    try {
      const result = await apiService.unifiedLogin({
        identifier,
        password,
        rememberMe,
      });
      applySession(result);
    } catch (err) {
      handleError(err, 'password');
    } finally {
      setLoading(false);
    }
  };

  /* --------------------- Создание пароля (первый вход) -------------------- */

  const submitSetupPassword = async () => {
    if (setupSubmitLock.current || loading) return;
    setErrors({});
    const next: Record<string, string> = {};

    const setupTarget =
      setupAccounts.find((a) => a.id === setupAccountId) ||
      (setupAccounts.length === 1 ? setupAccounts[0] : undefined);
    if (setupAccounts.length > 1 && !setupTarget) {
      next.form = 'Выберите, для кого создаёте пароль';
    }
    if (password.length < 6) next.password = 'Пароль должен содержать минимум 6 символов';
    if (confirmPassword !== password) next.confirmPassword = 'Пароли не совпадают';
    if (!acceptTerms) next.acceptTerms = 'Необходимо принять условия соглашения';
    if (!acceptPrivacy) next.acceptPrivacy = 'Необходимо согласие на обработку персональных данных';

    if (Object.keys(next).length > 0) {
      setErrors(next);
      return;
    }

    setupSubmitLock.current = true;
    setLoading(true);
    try {
      const result = await apiService.setupPassword({
        identifier,
        password,
        confirmPassword,
        acceptTerms,
        acceptPrivacy,
        rememberMe,
        ...(setupTarget
          ? {
              accountType: setupTarget.accountType as 'CLIENT' | 'PARENT',
              accountId: setupTarget.id,
            }
          : {}),
      });
      applySession(result);
    } catch (err) {
      handleError(err, 'password');
    } finally {
      setupSubmitLock.current = false;
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
    setForgotCode('');
    setResetToken('');
    setForgotAccounts([]);
    setForgotAccount(null);
    setForgotNotice('');
    setChallengeToken('');
    setLoginCode('');
    setQrSecret('');
    setQrUrl('');
    goToStep('identify');
  };

  const startForgotPassword = () => {
    setErrors({});
    setForgotCode('');
    setForgotNotice('');
    setResetToken('');
    setForgotAccounts([]);
    setForgotAccount(null);
    const candidate =
      (contact || '').trim() ||
      (identifierType === 'email' ? (identifier || '').trim() : '');
    setForgotEmail(candidate.includes('@') ? candidate.toLowerCase() : '');
    goToStep('forgot_email');
  };

  const submitForgotRequest = async () => {
    setErrors({});
    setForgotNotice('');
    const value = forgotEmail.trim();
    if (!value || !value.includes('@')) {
      setErrors({ email: 'Введите корректный email' });
      return;
    }
    setLoading(true);
    try {
      const result = await apiService.requestPasswordReset(value);
      setForgotNotice(
        result?.message ||
          'Если аккаунт с этим email существует, мы отправили код на почту'
      );
      goToStep('forgot_code');
    } catch (err) {
      handleError(err, 'email');
    } finally {
      setLoading(false);
    }
  };

  const submitForgotCode = async () => {
    setErrors({});
    if (!/^\d{6}$/.test(forgotCode.trim())) {
      setErrors({ code: 'Введите 6-значный код' });
      return;
    }
    setLoading(true);
    try {
      const result = await apiService.verifyPasswordResetCode(forgotEmail.trim(), forgotCode.trim());
      setResetToken(result.resetToken);
      setForgotAccounts(result.accounts || []);
      if ((result.accounts || []).length === 1) {
        setForgotAccount(result.accounts[0]);
        goToStep('forgot_new_password');
      } else {
        goToStep('forgot_select');
      }
    } catch (err) {
      handleError(err, 'code');
    } finally {
      setLoading(false);
    }
  };

  const submitForgotNewPassword = async () => {
    setErrors({});
    if (!forgotAccount || !resetToken) {
      setErrors({ form: 'Сессия сброса истекла. Начните снова' });
      return;
    }
    if (password.length < 6) {
      setErrors({ password: 'Пароль должен содержать минимум 6 символов' });
      return;
    }
    if (password !== confirmPassword) {
      setErrors({ confirmPassword: 'Пароли не совпадают' });
      return;
    }
    setLoading(true);
    try {
      await apiService.confirmPasswordReset({
        resetToken,
        newPassword: password,
        accountType: forgotAccount.accountType,
        accountId: forgotAccount.id,
      });
      setNotice('Пароль изменён. Войдите с новым паролем');
      setPassword('');
      setConfirmPassword('');
      setForgotCode('');
      setResetToken('');
      if (forgotEmail) {
        setContact(forgotEmail.trim().toLowerCase());
        setIdentifierType('email');
        setIdentifier(forgotEmail.trim().toLowerCase());
      }
      goToStep('identify');
    } catch (err) {
      handleError(err, 'password');
    } finally {
      setLoading(false);
    }
  };

  /* ------------------------------ Разметка ------------------------------- */

  const formError = errors.form;

  const contactIcon =
    contact.includes('@') || identifierType === 'email' ? <MailOutline /> : <PhoneIphone />;

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

  /* ---- Единый экран входа ---- */
  const identifyStep = (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 2.5, md: 3.5 } }}>
      {savedAccounts.length > 0 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <Typography
            sx={{
              color: colors.textMuted,
              fontSize: typography.label,
              textAlign: 'center',
              fontWeight: 600,
            }}
          >
            Продолжить без повторного входа
          </Typography>
          {savedAccounts.map((account) => (
            <Button
              key={account.id}
              variant="outlined"
              disabled={switchingAccountId === account.id}
              onClick={() => void continueAsSavedAccount(account)}
              sx={{
                textTransform: 'none',
                justifyContent: 'flex-start',
                px: 2,
                py: 1.25,
                borderRadius: 2,
                borderColor: colors.border || 'divider',
                color: colors.text,
              }}
            >
              <Box sx={{ textAlign: 'left', minWidth: 0 }}>
                <Typography sx={{ fontWeight: 700, fontSize: typography.label }} noWrap>
                  {account.displayName}
                </Typography>
                {account.subtitle && (
                  <Typography sx={{ fontSize: typography.hint, color: colors.textMuted }} noWrap>
                    {account.subtitle}
                  </Typography>
                )}
              </Box>
            </Button>
          ))}
          <Divider sx={{ my: 0.5 }}>
            <Typography sx={{ color: colors.textMuted, fontSize: typography.hint }}>
              или войти заново
            </Typography>
          </Divider>
        </Box>
      )}

      <Typography
        sx={{
          color: colors.danger,
          fontSize: typography.hint,
          textAlign: 'left',
          lineHeight: 1.5,
        }}
      >
        *Чтоб войти в аккаунт, необходимо чтобы номер или email были в базе
        <br />
        спорт школы
      </Typography>

      <PillField
        name="contact"
        icon={contactIcon}
        placeholder="Email или телефон"
        type="text"
        autoComplete="username"
        autoFocus
        value={contact}
        onChange={(v) => setContact(formatContactInput(v))}
        error={errors.contact}
        onEnter={submitIdentify}
      />

      {errorBanner}
      {noticeBanner}

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
          Продолжить
        </AuthButton>
        {!testingMode && (
          <>
            <AuthButton variant="dark" onClick={() => navigate('/partner/register')}>
              Стать партнером
            </AuthButton>
            <AuthButton variant="dark" onClick={() => navigate('/marketer/register')}>
              Стать маркетологом
            </AuthButton>
          </>
        )}
      </Box>

      <Box sx={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Typography
          component="button"
          type="button"
          onClick={startForgotPassword}
          sx={{
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            fontFamily: 'inherit',
            color: colors.primary,
            fontSize: typography.hint,
            '&:hover': { textDecoration: 'underline' },
          }}
        >
          Забыли пароль?
        </Typography>
        <Typography
          component="button"
          type="button"
          disabled={loading}
          onClick={() => void startEmailCodeLogin()}
          sx={{
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            fontFamily: 'inherit',
            color: colors.primary,
            fontSize: typography.hint,
            '&:hover': { textDecoration: 'underline' },
          }}
        >
          Войти по коду с почты
        </Typography>
        <Typography
          component="button"
          type="button"
          disabled={loading}
          onClick={() => void startPushLogin()}
          sx={{
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            fontFamily: 'inherit',
            color: colors.primary,
            fontSize: typography.hint,
            '&:hover': { textDecoration: 'underline' },
          }}
        >
          Войти с другого устройства
        </Typography>
        <Typography
          component="button"
          type="button"
          disabled={loading}
          onClick={() => void startQrLogin()}
          sx={{
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            fontFamily: 'inherit',
            color: colors.primary,
            fontSize: typography.hint,
            '&:hover': { textDecoration: 'underline' },
          }}
        >
          Войти по QR-коду
        </Typography>
      </Box>
    </Box>
  );

  const codeStep = (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 2.5, md: 3 } }}>
      <Typography sx={{ color: colors.textMuted, fontSize: typography.label, textAlign: 'center' }}>
        {step === 'push_code'
          ? 'Введите код из уведомления на другом устройстве'
          : step === 'twofa_code'
            ? 'Введите код из письма для подтверждения входа'
            : 'Введите код из письма'}
      </Typography>
      <PillField
        name="loginCode"
        icon={<LockOutlined />}
        placeholder="Код из 6 цифр"
        type="text"
        autoComplete="one-time-code"
        autoFocus
        value={loginCode}
        onChange={setLoginCode}
        error={errors.code}
        onEnter={submitEmailCode}
      />
      {errorBanner}
      {noticeBanner}
      <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, pt: 1 }}>
        <AuthButton onClick={submitEmailCode} loading={loading}>
          Продолжить
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
          Назад
        </Typography>
      </Box>
    </Box>
  );

  const qrWaitStep = (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center' }}>
      <Typography sx={{ color: colors.textMuted, fontSize: typography.label, textAlign: 'center' }}>
        Отсканируйте код камерой телефона в браузере или приложении, где вы уже вошли — аккаунт
        определится автоматически
      </Typography>
      {qrUrl ? (
        <Box
          component="img"
          src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(qrUrl)}`}
          alt="QR для входа"
          sx={{ width: 240, height: 240, borderRadius: 1 }}
        />
      ) : null}
      {errorBanner}
      {noticeBanner}
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
        Отмена
      </Typography>
    </Box>
  );

  /* ---- Шаг: существующий пароль ---- */
  const passwordStep = (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 2.5, md: 3 } }}>
      {identifierFieldForNextSteps}

      <PillField
        name="password"
        icon={<LockOutlined />}
        placeholder="Пароль"
        type="password"
        autoComplete="current-password"
        autoFocus
        revealable
        value={password}
        onChange={setPassword}
        error={errors.password}
        onEnter={submitPasswordLogin}
      />

      <TermsCheckbox checked={rememberMe} onChange={setRememberMe} label="Запомнить меня" />

      {errorBanner}
      {noticeBanner}

      <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, pt: { xs: 1, md: 2 } }}>
        <AuthButton onClick={submitPasswordLogin} loading={loading}>
          Войти
        </AuthButton>
      </Box>

      <Box sx={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Typography
          component="button"
          type="button"
          onClick={startForgotPassword}
          sx={{
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            fontFamily: 'inherit',
            color: colors.primary,
            fontSize: typography.hint,
            '&:hover': { textDecoration: 'underline' },
          }}
        >
          Забыли пароль?
        </Typography>
        <Typography
          component="button"
          type="button"
          onClick={() => {
            setPassword('');
            setErrors({});
            setNotice('');
            goToStep('identify');
          }}
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

  /* ---- Шаг: создание пароля (первый вход) ---- */
  const setupStep = (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 2.5, md: 3 } }}>
      {identifierFieldForNextSteps}

      {setupAccounts.length > 1 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Typography sx={{ fontSize: typography.label, fontWeight: 700, color: '#1B2438' }}>
            Для кого пароль
          </Typography>
          {setupAccounts.map((a) => {
            const selected = setupAccountId === a.id;
            const role = a.accountType === 'PARENT' ? 'Родитель' : 'Спортсмен';
            return (
              <Box
                key={`${a.accountType}:${a.id}`}
                component="button"
                type="button"
                onClick={() => setSetupAccountId(a.id)}
                sx={{
                  textAlign: 'left',
                  border: '1px solid',
                  borderColor: selected ? colors.primary : '#E6EAF2',
                  bgcolor: selected ? '#F4F7FF' : '#fff',
                  borderRadius: '12px',
                  px: 1.5,
                  py: 1.25,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                <Typography sx={{ fontWeight: 700, fontSize: 14 }}>{a.displayName}</Typography>
                <Typography sx={{ fontSize: 12, color: colors.textMuted }}>
                  {role}
                  {a.tenant?.name ? ` · ${a.tenant.name}` : ''}
                  {a.childName ? ` · ${a.childName}` : ''}
                </Typography>
              </Box>
            );
          })}
        </Box>
      )}

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

      <LegalConsentCheckboxes
        acceptTerms={acceptTerms}
        acceptPrivacy={acceptPrivacy}
        onAcceptTerms={setAcceptTerms}
        onAcceptPrivacy={setAcceptPrivacy}
        termsError={errors.acceptTerms}
        privacyError={errors.acceptPrivacy}
      />

      {errorBanner}
      {noticeBanner}

      <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, pt: { xs: 1, md: 2 } }}>
        <AuthButton onClick={submitSetupPassword} loading={loading}>
          Войти
        </AuthButton>
      </Box>

      <Box sx={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Typography
          component="button"
          type="button"
          onClick={() => {
            setConfirmPassword('');
            setAcceptTerms(false);
            setAcceptPrivacy(false);
            setErrors({});
            setNotice('');
            goToStep('password');
          }}
          sx={{
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            fontFamily: 'inherit',
            color: colors.primary,
            fontSize: typography.hint,
            fontWeight: 600,
            '&:hover': { textDecoration: 'underline' },
          }}
        >
          У меня уже есть пароль
        </Typography>
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

  const forgotEmailStep = (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 2.5, md: 3 } }}>
      <Typography sx={{ color: colors.textMuted, fontSize: typography.label, textAlign: 'center' }}>
        Укажите email аккаунта — мы отправим код для сброса пароля
      </Typography>
      <PillField
        name="forgotEmail"
        icon={<MailOutline />}
        placeholder="Email"
        type="email"
        autoComplete="email"
        autoFocus
        value={forgotEmail}
        onChange={setForgotEmail}
        error={errors.email}
        onEnter={submitForgotRequest}
      />
      {errorBanner}
      <Box sx={{ display: 'flex', justifyContent: 'center', pt: 1 }}>
        <AuthButton onClick={submitForgotRequest} loading={loading}>
          Отправить код
        </AuthButton>
      </Box>
      <Box sx={{ textAlign: 'center' }}>
        <Typography
          component="button"
          type="button"
          onClick={() => goToStep('identify')}
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
          Назад ко входу
        </Typography>
      </Box>
    </Box>
  );

  const forgotCodeStep = (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 2.5, md: 3 } }}>
      {forgotNotice && (
        <Typography sx={{ color: colors.textMuted, fontSize: typography.label, textAlign: 'center' }}>
          {forgotNotice}
        </Typography>
      )}
      <PillField
        name="forgotCode"
        icon={<LockReset />}
        placeholder="Код из письма"
        autoComplete="one-time-code"
        autoFocus
        value={forgotCode}
        onChange={setForgotCode}
        error={errors.code}
        onEnter={submitForgotCode}
      />
      {errorBanner}
      <Box sx={{ display: 'flex', justifyContent: 'center', pt: 1 }}>
        <AuthButton onClick={submitForgotCode} loading={loading}>
          Подтвердить код
        </AuthButton>
      </Box>
      <Box sx={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Typography
          component="button"
          type="button"
          onClick={submitForgotRequest}
          sx={{
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            fontFamily: 'inherit',
            color: colors.primary,
            fontSize: typography.hint,
          }}
        >
          Отправить код ещё раз
        </Typography>
        <Typography
          component="button"
          type="button"
          onClick={() => goToStep('forgot_email')}
          sx={{
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            fontFamily: 'inherit',
            color: colors.textHint,
            fontSize: typography.hint,
          }}
        >
          Изменить email
        </Typography>
      </Box>
    </Box>
  );

  const forgotClientAccounts = forgotAccounts.filter(
    (a) => a.accountType === 'CLIENT' || a.accountType === 'PARENT'
  );
  const forgotStaffAccounts = forgotAccounts.filter((a) => a.accountType === 'TENANT_USER');
  const forgotMixed = forgotClientAccounts.length > 0 && forgotStaffAccounts.length > 0;

  const forgotSelectStep = (
    <AccountSelect
      clientAccounts={forgotClientAccounts}
      staffAccounts={forgotStaffAccounts}
      loading={loading}
      error={errors.form}
      submitLabel="Продолжить"
      onSubmit={(account) => {
        setForgotAccount(account);
        goToStep('forgot_new_password');
      }}
      onBack={() => goToStep('forgot_code')}
    />
  );

  const forgotNewPasswordStep = (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 2.5, md: 3 } }}>
      {forgotAccount && (
        <Typography sx={{ color: colors.textMuted, fontSize: typography.label, textAlign: 'center' }}>
          Новый пароль для:{' '}
          {forgotAccount.accountType === 'PARENT'
            ? `${forgotAccount.displayName} (Родитель${
                forgotAccount.childName ? ` · ${forgotAccount.childName}` : ''
              })`
            : forgotAccount.accountType === 'CLIENT'
              ? `${forgotAccount.displayName} (Ученик)`
              : forgotAccount.displayName}
          {forgotAccount.tenant?.name ? ` · ${forgotAccount.tenant.name}` : ''}
        </Typography>
      )}
      <PillField
        name="newPassword"
        icon={<LockOutlined />}
        placeholder="Новый пароль"
        type="password"
        autoComplete="new-password"
        autoFocus
        revealable
        value={password}
        onChange={setPassword}
        error={errors.password}
      />
      <PillField
        name="confirmNewPassword"
        icon={<LockOutlined />}
        placeholder="Подтвердите пароль"
        type="password"
        autoComplete="new-password"
        revealable
        value={confirmPassword}
        onChange={setConfirmPassword}
        error={errors.confirmPassword}
        onEnter={submitForgotNewPassword}
      />
      {errorBanner}
      <Box sx={{ display: 'flex', justifyContent: 'center', pt: 1 }}>
        <AuthButton onClick={submitForgotNewPassword} loading={loading}>
          Сохранить пароль
        </AuthButton>
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

  if (step === 'select' || step === 'forgot_select') {
    if ((step === 'select' && isMixed) || (step === 'forgot_select' && forgotMixed)) {
      width = 'full';
    } else {
      width = 'select';
      if (step === 'select' && hasStaff && !hasClients) titleSecondLine = 'Сотрудника';
    }
  }

  if (
    step === 'forgot_email' ||
    step === 'forgot_code' ||
    step === 'forgot_new_password' ||
    step === 'forgot_select'
  ) {
    title = 'Сброс пароля';
  }

  const content =
    step === 'identify'
      ? identifyStep
      : step === 'password'
        ? passwordStep
        : step === 'setup'
          ? setupStep
          : step === 'email_code' || step === 'twofa_code' || step === 'push_code'
            ? codeStep
            : step === 'qr_wait'
              ? qrWaitStep
              : step === 'forgot_email'
                ? forgotEmailStep
                : step === 'forgot_code'
                  ? forgotCodeStep
                  : step === 'forgot_select'
                    ? forgotSelectStep
                    : step === 'forgot_new_password'
                      ? forgotNewPasswordStep
                      : selectStep;

  return (
    <AuthShell
      title={title}
      titleSecondLine={titleSecondLine}
      width={width}
      card={
        !(
          (step === 'select' && isMixed) ||
          (step === 'forgot_select' && forgotMixed)
        )
      }
    >
      <StepTransition stepKey={step} direction={direction}>
        {content}
      </StepTransition>
    </AuthShell>
  );
};

export default Auth;
