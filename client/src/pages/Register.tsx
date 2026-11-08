import React, { useState } from 'react';
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
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { RegisterForm } from '../types';
import { normalizePhone, validatePhone } from '../utils/phone';
import AuthShell from '../components/auth/AuthShell';
import AuthButton from '../components/auth/AuthButton';
import PillField from '../components/auth/PillField';
import { colors, typography } from '../theme/tokens';

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
      fontWeight: 700,
      color: colors.text,
      mb: { xs: 1.5, md: 2 },
      letterSpacing: '-0.01em',
    }}
  >
    {children}
  </Typography>
);

const Register: React.FC = () => {
  const [formData, setFormData] = useState<RegisterForm>({
    tenantName: '',
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    phone: '',
  });
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const { register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const nextAfterRegister =
    (location.state as { next?: string } | null)?.next === '/pricing' ? '/pricing' : '/dashboard';

  const setField = (name: keyof RegisterForm) => (value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (error) setError('');
    if (fieldErrors[name]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  const validateForm = (): Record<string, string> => {
    const errors: Record<string, string> = {};

    if (!formData.tenantName || formData.tenantName.trim().length < 2) {
      errors.tenantName = 'Название школы должно содержать минимум 2 символа';
    }
    if (!formData.firstName || formData.firstName.trim().length < 2) {
      errors.firstName = 'Имя должно содержать минимум 2 символа';
    }
    if (!formData.lastName || formData.lastName.trim().length < 2) {
      errors.lastName = 'Фамилия должна содержать минимум 2 символа';
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email || !emailRegex.test(formData.email)) {
      errors.email = 'Введите корректный адрес электронной почты';
    }

    if (!formData.password || formData.password.length < 6) {
      errors.password = 'Пароль должен содержать минимум 6 символов';
    }
    if (formData.password !== confirmPassword) {
      errors.confirmPassword = 'Пароли не совпадают';
    }

    if (formData.phone && formData.phone.trim() !== '') {
      const phoneError = validatePhone(formData.phone);
      if (phoneError) errors.phone = phoneError;
    }

    return errors;
  };

  const handleSubmit = async () => {
    setIsLoading(true);
    setError('');

    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setError('Пожалуйста, исправьте ошибки в форме');
      setIsLoading(false);
      return;
    }

    setFieldErrors({});

    try {
      const cleanedData = {
        ...formData,
        phone: formData.phone?.trim() ? normalizePhone(formData.phone) : undefined,
        tenantName: formData.tenantName.trim(),
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        email: formData.email.trim().toLowerCase(),
      };

      await register(cleanedData);
      navigate(nextAfterRegister);
    } catch (err: any) {
      const errorMessage =
        err.response?.data?.error || err.message || 'Ошибка регистрации. Попробуйте еще раз.';

      let translatedError = errorMessage;
      if (
        errorMessage.includes('Email is already registered') ||
        errorMessage.includes('Email уже зарегистрирован') ||
        errorMessage.includes('already exists') ||
        errorMessage.includes('уже существует')
      ) {
        translatedError =
          'Этот email уже зарегистрирован. Используйте другой email или войдите в систему.';
      } else if (
        errorMessage.includes('Subdomain is already taken') ||
        errorMessage.includes('поддомен')
      ) {
        translatedError = 'Ошибка создания аккаунта. Попробуйте другое название школы.';
      } else if (errorMessage.includes('validation') || errorMessage.includes('проверки данных')) {
        translatedError = 'Проверьте правильность заполнения всех полей.';
      }

      setError(translatedError);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthShell
      title="Создайте свою спортивную школу"
      subtitle="Шаг 1: регистрация. После входа можно выбрать тариф или написать в контакты."
      width="register"
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 3, md: 3.5 } }}>
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 1,
            justifyContent: { xs: 'center', md: 'flex-start' },
          }}
        >
          {[
            { label: '1. Регистрация', active: true, to: null as string | null },
            { label: '2. Тарифы', active: false, to: '/pricing' },
            { label: '3. Контакты', active: false, to: '/contacts' },
          ].map((step) => (
            <Box
              key={step.label}
              component={step.to ? 'button' : 'span'}
              type={step.to ? 'button' : undefined}
              onClick={step.to ? () => navigate(step.to!) : undefined}
              sx={{
                border: step.active ? 'none' : `1px solid ${colors.divider}`,
                bgcolor: step.active ? colors.primary : colors.white,
                color: step.active ? colors.white : colors.textMuted,
                borderRadius: 999,
                px: 1.75,
                py: 0.75,
                fontSize: 13,
                fontWeight: 600,
                fontFamily: 'inherit',
                cursor: step.to ? 'pointer' : 'default',
                '&:hover': step.to
                  ? { borderColor: colors.primary, color: colors.primary }
                  : undefined,
              }}
            >
              {step.label}
            </Box>
          ))}
        </Box>

        <Box>
          <SectionTitle>Информация о школе</SectionTitle>
          <PillField
            dense
            name="tenantName"
            label="Название школы *"
            icon={<SchoolOutlined />}
            placeholder="Например, Спортивная школа «Бокс»"
            value={formData.tenantName}
            onChange={setField('tenantName')}
            error={fieldErrors.tenantName}
            disabled={isLoading}
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
              value={formData.firstName}
              onChange={setField('firstName')}
              error={fieldErrors.firstName}
              disabled={isLoading}
            />
            <PillField
              dense
              name="lastName"
              label="Фамилия *"
              icon={<BadgeOutlined />}
              placeholder="Фамилия"
              autoComplete="family-name"
              value={formData.lastName}
              onChange={setField('lastName')}
              error={fieldErrors.lastName}
              disabled={isLoading}
            />
            <PillField
              dense
              name="email"
              label="Email *"
              icon={<MailOutline />}
              placeholder="Email"
              type="email"
              autoComplete="email"
              value={formData.email}
              onChange={(v) => setField('email')(v.toLowerCase())}
              error={fieldErrors.email}
              hint="Будет использован для входа в систему"
              disabled={isLoading}
            />
            <PillField
              dense
              name="phone"
              label="Телефон"
              icon={<PhoneIphone />}
              placeholder="+7 (999) 999-99-99"
              type="tel"
              autoComplete="tel"
              value={formData.phone ?? ''}
              onChange={(v) => setField('phone')(maskPhone(v))}
              error={fieldErrors.phone}
              hint="Необязательно"
              disabled={isLoading}
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
              value={formData.password}
              onChange={setField('password')}
              error={fieldErrors.password}
              hint="Минимум 6 символов"
              disabled={isLoading}
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
              value={confirmPassword}
              onChange={(v) => {
                setConfirmPassword(v);
                if (fieldErrors.confirmPassword) {
                  setFieldErrors((prev) => {
                    const next = { ...prev };
                    delete next.confirmPassword;
                    return next;
                  });
                }
              }}
              error={
                fieldErrors.confirmPassword ||
                (confirmPassword !== '' && formData.password !== confirmPassword
                  ? 'Пароли не совпадают'
                  : undefined)
              }
              disabled={isLoading}
              onEnter={handleSubmit}
            />
          </Box>
        </Box>

        {error && (
          <Typography
            role="alert"
            sx={{ color: colors.danger, fontSize: typography.label, textAlign: 'center' }}
          >
            {error}
          </Typography>
        )}

        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
          <AuthButton onClick={handleSubmit} loading={isLoading}>
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

        <Box
          sx={{
            pt: 1,
            borderTop: `1px solid ${colors.divider}`,
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
            gap: 1.25,
          }}
        >
          {[
            'Управление клиентами и группами',
            'Расписание и посещаемость',
            'Платежи и абонементы',
            'ЛК ученика и родителя',
          ].map((item) => (
            <Typography key={item} sx={{ color: colors.textMuted, fontSize: 13, lineHeight: 1.4 }}>
              <Box component="span" sx={{ color: colors.primary, fontWeight: 700, mr: 0.75 }}>
                ✓
              </Box>
              {item}
            </Typography>
          ))}
        </Box>
      </Box>
    </AuthShell>
  );
};

export default Register;
