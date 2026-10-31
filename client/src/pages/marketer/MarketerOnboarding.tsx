import React, { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  FormControlLabel,
  Link,
  Step,
  StepLabel,
  Stepper,
  Typography,
} from '@mui/material';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { apiService } from '../../services/api';
import { notifyMarketerOnboardingChanged } from '../../hooks/useMarketerCabinetReady';
import { colors, typography } from '../../theme/tokens';
import { formatMarketerMissing, marketerCardSx } from './marketerUi';

const cardSx = {
  ...marketerCardSx,
  border: '1px solid #EEF1F6',
  p: { xs: 2, md: 2.5 },
} as const;

const MarketerOnboarding: React.FC = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [checks, setChecks] = useState({
    offer: false,
    programRules: false,
    pep: false,
    pdn: false,
  });

  const load = async () => {
    const res = await apiService.getMarketerOnboarding();
    setData(res);
    setChecks({
      offer: !!res.acceptances?.offer?.at && res.acceptances.offer.version === res.docVersion,
      programRules:
        !!res.acceptances?.programRules?.at &&
        res.acceptances.programRules.version === res.docVersion,
      pep: !!res.acceptances?.pep?.at && res.acceptances.pep.version === res.docVersion,
      pdn: !!res.acceptances?.pdn?.at && res.acceptances.pdn.version === res.docVersion,
    });
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        await load();
      } catch (e: any) {
        if (!cancelled) setError(e?.response?.data?.error || 'Не удалось загрузить онбординг');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py={6}>
        <CircularProgress />
      </Box>
    );
  }
  if (!data) return <Alert severity="error">{error || 'Нет данных'}</Alert>;

  const steps = data.steps || [];
  const activeStep = data.onboarding?.complete
    ? 2
    : steps[1]?.done
      ? 2
      : steps[0]?.done
        ? 1
        : 0;
  const missing: string[] = data.onboarding?.missing || [];
  const profileMissing = missing.filter((m) =>
    ['name', 'phone', 'inn', 'taxStatus', 'bank'].includes(m)
  );

  const accept = async () => {
    setError('');
    if (!checks.offer || !checks.programRules || !checks.pep || !checks.pdn) {
      setError('Примите все документы');
      return;
    }
    try {
      setBusy(true);
      const res = await apiService.acceptMarketerOnboarding({
        offer: true,
        programRules: true,
        pep: true,
        pdn: true,
      });
      setData(res);
      notifyMarketerOnboardingChanged();
      if (res?.onboarding?.complete) {
        navigate('/marketer/dashboard');
      }
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось сохранить согласия');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box sx={{ width: '100%', maxWidth: 720, pb: 4 }}>
      <Typography sx={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', color: colors.primary, mb: 0.75 }}>
        ПОДКЛЮЧЕНИЕ
      </Typography>
      <Typography sx={{ fontWeight: 800, fontSize: { xs: 24, md: 28 }, mb: 0.75 }}>
        Подключение к программе
      </Typography>
      <Typography sx={{ color: colors.textMuted, fontSize: typography.label, mb: 2 }}>
        Заполните профиль, примите документы и получите доступ к выводу средств.
      </Typography>

      <Alert severity="info" sx={{ mb: 2 }}>
        Документы — черновики до юридического согласования. CRM-разделы доступны и без завершения онбординга; вывод
        средств — только после полного подключения.
      </Alert>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      <Stepper activeStep={activeStep} alternativeLabel sx={{ mb: 3 }}>
        {['Профиль', 'Документы', 'Готово'].map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      <Box sx={{ ...cardSx, mb: 2 }}>
        <Typography fontWeight={800} mb={1}>
          1. Профиль и реквизиты
        </Typography>
        {profileMissing.length === 0 ? (
          <Alert severity="success">Профиль заполнен</Alert>
        ) : (
          <>
            <Typography sx={{ fontSize: typography.hint, color: colors.textMuted, mb: 1.5, lineHeight: 1.5 }}>
              Чтобы продолжить, заполните в профиле: {formatMarketerMissing(profileMissing)}.
            </Typography>
            <Button
              component={RouterLink}
              to="/marketer/profile"
              variant="contained"
              sx={{ textTransform: 'none', fontWeight: 800 }}
            >
              Заполнить профиль
            </Button>
          </>
        )}
      </Box>

      <Box sx={{ ...cardSx, mb: 2 }}>
        <Typography fontWeight={800} mb={1}>
          2. Документы и согласия
        </Typography>
        <Typography sx={{ fontSize: typography.hint, color: colors.textMuted, mb: 2 }}>
          Версия комплекта: {data.docVersion}
        </Typography>
        {(data.docs || []).map((d: any) => (
          <Box key={d.key} sx={{ mb: 1.5 }}>
            <Link href={d.url} target="_blank" rel="noopener noreferrer" fontWeight={700}>
              {d.title} (PDF)
            </Link>
          </Box>
        ))}
        {[
          {
            key: 'programRules' as const,
            label: 'Принимаю правила партнёрской программы, включая условие 3 оплат за 3 месяца',
          },
          { key: 'offer' as const, label: 'Принимаю оферту маркетолога' },
          {
            key: 'pep' as const,
            label: 'Согласен на простую электронную подпись (код на email / в UI как СМС)',
          },
          { key: 'pdn' as const, label: 'Согласие на обработку персональных данных' },
        ].map((item) => (
          <FormControlLabel
            key={item.key}
            sx={{
              alignItems: 'flex-start',
              m: 0,
              mb: 1,
              gap: 1,
              width: '100%',
              '& .MuiFormControlLabel-label': {
                fontSize: 13,
                lineHeight: 1.45,
                whiteSpace: 'normal',
              },
            }}
            control={
              <Checkbox
                checked={checks[item.key]}
                onChange={(e) => setChecks((s) => ({ ...s, [item.key]: e.target.checked }))}
                sx={{ pt: 0.25 }}
              />
            }
            label={item.label}
          />
        ))}
        <Button
          variant="contained"
          onClick={() => void accept()}
          disabled={busy || profileMissing.length > 0}
          sx={{ mt: 1.5, textTransform: 'none', fontWeight: 800 }}
        >
          {busy ? 'Сохранение…' : 'Подтвердить согласия'}
        </Button>
      </Box>

      <Box sx={{ ...cardSx }}>
        <Typography fontWeight={800} mb={1}>
          3. Готово
        </Typography>
        {data.onboarding?.complete ? (
          <>
            <Alert severity="success" sx={{ mb: 2 }}>
              Онбординг завершён. Можно запрашивать вывод средств.
            </Alert>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              <Button
                variant="contained"
                onClick={() => navigate('/marketer/clients')}
                sx={{ textTransform: 'none', fontWeight: 800 }}
              >
                К клиентам
              </Button>
              <Button
                variant="outlined"
                onClick={() => navigate('/marketer/finance')}
                sx={{ textTransform: 'none', fontWeight: 700 }}
              >
                Финансы
              </Button>
            </Box>
          </>
        ) : (
          <Typography color="text.secondary">
            Завершите шаги 1–2. После этого станет доступен вывод на странице «Финансы».
          </Typography>
        )}
      </Box>
    </Box>
  );
};

export default MarketerOnboarding;
