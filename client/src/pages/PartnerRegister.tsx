import React from 'react';
import { Box, Typography } from '@mui/material';
import {
  SchoolOutlined,
  PersonOutline,
  BadgeOutlined,
  MailOutline,
  PhoneIphone,
  LockOutlined,
  LockReset,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../services/api';
import { applyUnifiedSession, clearAllAuthStorage, extractApiError } from '../utils/authSession';
import AuthShell from '../components/auth/AuthShell';
import AuthButton from '../components/auth/AuthButton';
import PillField from '../components/auth/PillField';
import TermsCheckbox from '../components/auth/TermsCheckbox';
import { colors, typography } from '../theme/tokens';

/** Приводит введённый номер к формату +79999999999, который ждёт backend. */
function normalizePhoneForApi(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  const body = digits.startsWith('8') ? digits.slice(1) : digits.startsWith('7') ? digits.slice(1) : digits;
  return `+7${body.slice(0, 10)}`;
}

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

const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Typography
    sx={{
      fontSize: typography.field,
      fontWeight: 600,
      color: colors.text,
      mb: { xs: 1.5, md: 2 },
    }}
  >
    {children}
  </Typography>
);

/**
 * Регистрация спортивной школы («Стать партнером»).
 * Верстка по макету dorabot/1920w регистрация.pdf.
 */
const PartnerRegister: React.FC = () => {
  const navigate = useNavigate();

  const [form, setForm] = React.useState({
    tenantName: '',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });
  const [acceptTerms, setAcceptTerms] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [loading, setLoading] = React.useState(false);

  const set = (key: keyof typeof form) => (value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const validate = (): Record<string, string> => {
    const next: Record<string, string> = {};

    if (form.tenantName.trim().length < 2) next.tenantName = 'Введите название школы';
    if (form.firstName.trim().length < 2) next.firstName = 'Введите имя';
    if (form.lastName.trim().length < 2) next.lastName = 'Введите фамилию';

    const email = form.email.trim().toLowerCase();
    if (!email) next.email = 'Введите email';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.email = 'Введите корректный email';

    if (form.phone.trim()) {
      const digits = form.phone.replace(/\D/g, '');
      const body = digits.startsWith('7') || digits.startsWith('8') ? digits.slice(1) : digits;
      if (body.length !== 10) next.phone = 'Формат: +7 (999) 999-99-99';
    }

    if (form.password.length < 6) next.password = 'Минимум 6 символов';
    if (form.confirmPassword !== form.password) next.confirmPassword = 'Пароли не совпадают';
    if (!acceptTerms) next.acceptTerms = 'Необходимо принять условия соглашения';

    return next;
  };

  const submit = async () => {
    const next = validate();
    if (Object.keys(next).length > 0) {
      setErrors(next);
      return;
    }

    setLoading(true);
    setErrors({});
    try {
      clearAllAuthStorage();
      const result = await apiService.register({
        tenantName: form.tenantName.trim(),
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        ...(form.phone.trim() ? { phone: normalizePhoneForApi(form.phone) } : {}),
      });

      const dest = applyUnifiedSession({
        requiresSelection: false,
        accountType: 'TENANT_USER',
        token: result.token,
        user: result.user,
        tenant: result.tenant,
      });
      window.location.assign(dest);
    } catch (err) {
      const { message, field } = extractApiError(err, 'Не удалось создать аккаунт');
      const mapped =
        message.toLowerCase().includes('email is already registered') ||
        message.toLowerCase().includes('уже зарегистрирован')
          ? { email: 'Этот email уже зарегистрирован' }
          : { [field || 'form']: message };
      setErrors(mapped);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Создайте свою спортивную школу" width="register">
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 3, md: 4 } }}>
        <Box>
          <SectionTitle>Информация о школе</SectionTitle>
          <PillField
            dense
            name="tenantName"
            label="Название школы *"
            icon={<SchoolOutlined />}
            placeholder="Например, Спортивная школа «Бокс»"
            value={form.tenantName}
            onChange={set('tenantName')}
            error={errors.tenantName}
            autoFocus
          />
        </Box>

        <Box>
          <SectionTitle>Информация о владельце</SectionTitle>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
              gap: { xs: 2.5, md: 3 },
            }}
          >
            <PillField
              dense
              name="firstName"
              label="Имя *"
              icon={<PersonOutline />}
              placeholder="Имя"
              autoComplete="given-name"
              value={form.firstName}
              onChange={set('firstName')}
              error={errors.firstName}
            />
            <PillField
              dense
              name="lastName"
              label="Фамилия *"
              icon={<BadgeOutlined />}
              placeholder="Фамилия"
              autoComplete="family-name"
              value={form.lastName}
              onChange={set('lastName')}
              error={errors.lastName}
            />
            <PillField
              dense
              name="email"
              label="Email *"
              icon={<MailOutline />}
              placeholder="Email"
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={(v) => set('email')(v.toLowerCase())}
              error={errors.email}
              hint="Будет использован для входа в систему"
            />
            <PillField
              dense
              name="phone"
              label="Телефон"
              icon={<PhoneIphone />}
              placeholder="+7 (999) 999-99-99"
              type="tel"
              autoComplete="tel"
              value={form.phone}
              onChange={(v) => set('phone')(maskPhone(v))}
              error={errors.phone}
              hint="Необязательно"
            />
            <PillField
              dense
              name="password"
              label="Придумайте пароль *"
              icon={<LockOutlined />}
              placeholder="Пароль"
              type="password"
              autoComplete="new-password"
              revealable
              value={form.password}
              onChange={set('password')}
              error={errors.password}
              hint="Минимум 6 символов"
            />
            <PillField
              dense
              name="confirmPassword"
              label="Подтвердите пароль *"
              icon={<LockReset />}
              placeholder="Пароль ещё раз"
              type="password"
              autoComplete="new-password"
              revealable
              value={form.confirmPassword}
              onChange={set('confirmPassword')}
              error={errors.confirmPassword}
              onEnter={submit}
            />
          </Box>
        </Box>

        <Box>
          <TermsCheckbox
            checked={acceptTerms}
            onChange={(v) => {
              setAcceptTerms(v);
              setErrors((prev) => {
                if (!prev.acceptTerms) return prev;
                const next = { ...prev };
                delete next.acceptTerms;
                return next;
              });
            }}
            error={Boolean(errors.acceptTerms)}
          />
          {errors.acceptTerms && (
            <Typography sx={{ color: colors.danger, fontSize: typography.hint, ml: 4.5, mt: 0.5 }}>
              {errors.acceptTerms}
            </Typography>
          )}
        </Box>

        {errors.form && (
          <Typography
            role="alert"
            sx={{ color: colors.danger, fontSize: typography.label, textAlign: 'center' }}
          >
            {errors.form}
          </Typography>
        )}

        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
          <AuthButton onClick={submit} loading={loading}>
            Создать аккаунт
          </AuthButton>
        </Box>

        <Box sx={{ textAlign: 'center' }}>
          <Typography
            component="button"
            type="button"
            onClick={() => navigate('/auth')}
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
            У меня уже есть аккаунт
          </Typography>
        </Box>
      </Box>
    </AuthShell>
  );
};

export default PartnerRegister;
