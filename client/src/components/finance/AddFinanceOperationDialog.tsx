import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  Dialog,
  FormControl,
  IconButton,
  InputAdornment,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  CalendarMonthOutlined,
  CheckCircleOutline,
  Close,
  InfoOutlined,
  PaymentsOutlined,
} from '@mui/icons-material';
import { DatePicker, DateTimePicker } from '@mui/x-date-pickers';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { ru } from 'date-fns/locale';
import { apiService } from '../../services/api';
import { Client, FinanceDirection, Trainer } from '../../types';
import { colors } from '../../theme/tokens';
import UnsavedChangesDialog from '../common/UnsavedChangesDialog';
import { isDirtyValue, useUnsavedClose } from '../../hooks/useUnsavedClose';

const ADD_OP_SYSTEM_TYPES: Array<{ code: string; name: string }> = [
  { code: 'rent', name: 'Аренда' },
  { code: 'membership_issue', name: 'Выдача абонемента' },
  { code: 'salary', name: 'Зарплата' },
  { code: 'bonus', name: 'Премия' },
  { code: 'purchase', name: 'Покупка' },
  { code: 'advertising', name: 'Реклама' },
  { code: 'other', name: 'Прочее' },
];

const CUSTOM_TYPE_VALUE = '__custom__';
type CustomSubject = 'client' | 'trainer';
type CustomAllocation = 'accrued' | 'paid' | 'debit' | 'credit';

const formatClientOptionLabel = (c: {
  lastName?: string | null;
  firstName?: string | null;
  middleName?: string | null;
  balance?: number | null;
  groupName?: string | null;
  groupMemberships?: Array<{ group?: { name?: string | null } | null }>;
}) => {
  const name = [c.lastName, c.firstName, c.middleName].filter(Boolean).join(' ');
  const group =
    c.groupName ||
    c.groupMemberships?.find((gm) => gm.group?.name)?.group?.name ||
    'без группы';
  const bal = Number(c.balance ?? 0);
  const balStr = `${bal.toLocaleString('ru-RU', { maximumFractionDigits: 0 })} ₽`;
  return `${name} — ${group} — ${balStr}`;
};

const formatMoney = (value: number) => {
  const abs = Math.abs(value).toLocaleString('ru-RU');
  return value < 0 ? `−${abs} ₽` : `${abs} ₽`;
};

const trainerLabel = (t: Trainer) =>
  t.user
    ? `${t.user.lastName || ''} ${t.user.firstName || ''} ${t.user.middleName || ''}`.trim()
    : `Тренер #${t.id}`;

export type AddFinanceSuccessPayload = {
  message: string;
  refresh?: Array<'operations' | 'salary' | 'memberships' | 'types'>;
};

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess?: (payload: AddFinanceSuccessPayload) => void;
}

const fieldSx = {
  '& .MuiOutlinedInput-root': {
    borderRadius: '10px',
    bgcolor: '#fff',
    '& fieldset': { borderColor: '#E5E9F2' },
    '&:hover fieldset': { borderColor: '#C9D7FF' },
    '&.Mui-focused fieldset': { borderColor: colors.primary },
  },
};

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <Typography sx={{ fontSize: 13, fontWeight: 750, color: '#1B2438', mb: 0.65 }}>
      {children}
      {required && (
        <Box component="span" sx={{ color: '#EF4444', ml: 0.35 }}>
          *
        </Box>
      )}
    </Typography>
  );
}

function SectionHead({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5, mt: 0.5 }}>
      <Box
        sx={{
          width: 28,
          height: 28,
          borderRadius: '8px',
          bgcolor: '#EEF4FF',
          color: colors.primary,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {icon}
      </Box>
      <Typography sx={{ fontWeight: 800, fontSize: 14, color: '#1B2438' }}>{title}</Typography>
    </Stack>
  );
}

/**
 * Диалог создания финансовой операции.
 * Стиль — по макету; функционал — как до UI-редизайна (без статуса и notes-метаданных).
 */
const AddFinanceOperationDialog: React.FC<Props> = ({ open, onClose, onSuccess }) => {
  const [formDirection, setFormDirection] = useState<FinanceDirection>('expense');
  const [formTypeCode, setFormTypeCode] = useState('rent');
  const [formTitle, setFormTitle] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formOccurredAt, setFormOccurredAt] = useState<Date | null>(new Date());
  const [formNotes, setFormNotes] = useState('');
  const [newTypeName, setNewTypeName] = useState('');
  const [formTrainerId, setFormTrainerId] = useState('');
  const [formClientId, setFormClientId] = useState('');
  const [formMembershipId, setFormMembershipId] = useState('');
  const [formMembershipStartDate, setFormMembershipStartDate] = useState<Date | null>(new Date());
  const [membershipCatalog, setMembershipCatalog] = useState<any[]>([]);
  const [membershipCatalogLoading, setMembershipCatalogLoading] = useState(false);
  const [customSubject, setCustomSubject] = useState<CustomSubject>('trainer');
  const [customAllocation, setCustomAllocation] = useState<CustomAllocation>('accrued');
  const [savingAdd, setSavingAdd] = useState(false);
  const [addFormBaseline, setAddFormBaseline] = useState<Record<string, unknown> | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [refsLoading, setRefsLoading] = useState(false);

  const isCustomType = formTypeCode === CUSTOM_TYPE_VALUE;

  const resetForm = useCallback(() => {
    setFormTypeCode('rent');
    setFormDirection('expense');
    setFormTitle('');
    setFormAmount('');
    setFormNotes('');
    setFormTrainerId('');
    setFormClientId('');
    setFormMembershipId('');
    setFormMembershipStartDate(new Date());
    setMembershipCatalog([]);
    setNewTypeName('');
    setCustomSubject('trainer');
    setCustomAllocation('accrued');
    setFormOccurredAt(new Date());
    setSavingAdd(false);
    setAddFormBaseline(null);
    setError(null);
  }, []);

  const discard = useCallback(() => {
    resetForm();
    onClose();
  }, [onClose, resetForm]);

  useEffect(() => {
    if (!open) return;
    resetForm();
    setTimeout(() => {
      setAddFormBaseline({
        formDirection: 'expense',
        formTypeCode: 'rent',
        formTitle: '',
        formAmount: '',
        formOccurredAt: new Date().toISOString(),
        formNotes: '',
        newTypeName: '',
        formTrainerId: '',
        formClientId: '',
        formMembershipId: '',
        customSubject: 'trainer',
        customAllocation: 'accrued',
      });
    }, 0);

    let cancelled = false;
    setRefsLoading(true);
    apiService
      .getFinanceRefs()
      .then((data) => {
        if (cancelled) return;
        setClients(data.clients || []);
        setTrainers(data.trainers || []);
      })
      .catch((e: any) => {
        if (!cancelled) {
          setError(e?.response?.data?.error || 'Не удалось загрузить справочники');
        }
      })
      .finally(() => {
        if (!cancelled) setRefsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, resetForm]);

  const loadMembershipCatalog = useCallback(async () => {
    setMembershipCatalogLoading(true);
    try {
      const res = await apiService.getMemberships({ limit: 200 });
      setMembershipCatalog(res?.data || []);
    } catch {
      setMembershipCatalog([]);
    } finally {
      setMembershipCatalogLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open || formTypeCode !== 'membership_issue') return;
    void loadMembershipCatalog();
  }, [open, formTypeCode, loadMembershipCatalog]);

  useEffect(() => {
    if (formTypeCode === 'membership_issue' && formMembershipId) {
      const pack = membershipCatalog.find((m) => m.id === formMembershipId);
      if (pack) {
        setFormTitle(pack.name || 'Выдача абонемента');
        if (pack.price != null) setFormAmount(String(Number(pack.price)));
      }
    }
  }, [formMembershipId, membershipCatalog, formTypeCode]);

  useEffect(() => {
    if (!isCustomType) return;
    if (customSubject === 'trainer') {
      setCustomAllocation((prev) => (prev === 'debit' || prev === 'credit' ? 'accrued' : prev));
      setFormClientId('');
    } else {
      setCustomAllocation((prev) => (prev === 'accrued' || prev === 'paid' ? 'credit' : prev));
      setFormTrainerId('');
    }
  }, [customSubject, isCustomType]);

  useEffect(() => {
    if (isCustomType) {
      if (customAllocation === 'credit') setFormDirection('income');
      else setFormDirection('expense');
    } else if (formTypeCode !== CUSTOM_TYPE_VALUE) {
      setFormDirection('expense');
    }
  }, [isCustomType, customAllocation, formTypeCode]);

  const addFormSnapshot = () => ({
    formDirection,
    formTypeCode,
    formTitle,
    formAmount,
    formOccurredAt: formOccurredAt?.toISOString() ?? null,
    formNotes,
    newTypeName,
    formTrainerId,
    formClientId,
    formMembershipId,
    customSubject,
    customAllocation,
  });

  const canSaveAddOperation = useMemo(() => {
    if (formTypeCode === 'rent') {
      return Boolean(formTitle.trim() && formAmount && Number(formAmount) > 0);
    }
    if (formTypeCode === 'purchase' || formTypeCode === 'advertising' || formTypeCode === 'other') {
      return Boolean(formTitle.trim() && formAmount && Number(formAmount) > 0);
    }
    if (formTypeCode === 'membership_issue') {
      return Boolean(formClientId && formMembershipId && formMembershipStartDate);
    }
    if (formTypeCode === 'salary' || formTypeCode === 'bonus') {
      return Boolean(formTrainerId && formAmount && Number(formAmount) > 0);
    }
    if (isCustomType) {
      const hasSubject =
        customSubject === 'trainer' ? Boolean(formTrainerId) : Boolean(formClientId);
      return Boolean(
        newTypeName.trim() &&
          hasSubject &&
          customAllocation &&
          formAmount &&
          Number(formAmount) > 0
      );
    }
    return false;
  }, [
    formTypeCode,
    formTitle,
    formAmount,
    formClientId,
    formMembershipId,
    formMembershipStartDate,
    formTrainerId,
    isCustomType,
    newTypeName,
    customSubject,
    customAllocation,
  ]);

  const handleSaveOperation = async (): Promise<boolean> => {
    if (!canSaveAddOperation) {
      setError('Заполните обязательные поля');
      return false;
    }
    setSavingAdd(true);
    setError(null);
    const notes = formNotes.trim() || undefined;
    try {
      if (formTypeCode === 'membership_issue') {
        await apiService.createClientMembership({
          clientId: formClientId,
          membershipId: formMembershipId,
          startDate: formMembershipStartDate!.toISOString(),
        });
        discard();
        onSuccess?.({ message: 'Абонемент выдан', refresh: ['operations', 'memberships'] });
        return true;
      }

      if (formTypeCode === 'salary') {
        const trainer = trainers.find((t) => t.id === formTrainerId);
        const name = trainer?.user
          ? `${trainer.user.lastName} ${trainer.user.firstName}`.trim()
          : 'Зарплата';
        await apiService.payoutTrainerSalary({
          trainerId: formTrainerId,
          amount: Number(formAmount),
          periodLabel: formTitle.trim() || undefined,
          occurredAt: formOccurredAt?.toISOString(),
          notes,
        });
        discard();
        onSuccess?.({
          message: `Выплата сохранена: ${name}`,
          refresh: ['operations', 'salary'],
        });
        return true;
      }

      if (formTypeCode === 'bonus') {
        const trainer = trainers.find((t) => t.id === formTrainerId);
        const name = trainer?.user
          ? `${trainer.user.lastName} ${trainer.user.firstName}`.trim()
          : 'Премия';
        await apiService.createFinanceOperation({
          direction: 'expense',
          typeCode: 'bonus',
          title: formTitle.trim() || `Премия — ${name}`,
          amount: Number(formAmount),
          occurredAt: formOccurredAt?.toISOString(),
          notes,
          trainerId: formTrainerId,
        });
        discard();
        onSuccess?.({ message: 'Премия начислена', refresh: ['operations', 'salary'] });
        return true;
      }

      if (
        formTypeCode === 'rent' ||
        formTypeCode === 'purchase' ||
        formTypeCode === 'advertising' ||
        formTypeCode === 'other'
      ) {
        await apiService.createFinanceOperation({
          direction: 'expense',
          typeCode: formTypeCode,
          title: formTitle.trim(),
          amount: Number(formAmount),
          occurredAt: formOccurredAt?.toISOString(),
          notes,
        });
        discard();
        onSuccess?.({ message: 'Операция сохранена', refresh: ['operations'] });
        return true;
      }

      if (isCustomType) {
        const created = await apiService.createFinanceType({
          name: newTypeName.trim(),
          defaultDirection: formDirection,
        });
        const title =
          formTitle.trim() ||
          (customSubject === 'trainer'
            ? (() => {
                const t = trainers.find((tr) => tr.id === formTrainerId);
                return t?.user
                  ? `${created.name} — ${t.user.lastName} ${t.user.firstName}`.trim()
                  : created.name;
              })()
            : (() => {
                const c = clients.find((cl) => cl.id === formClientId);
                return c ? `${created.name} — ${c.lastName} ${c.firstName}` : created.name;
              })());
        await apiService.createFinanceOperation({
          direction: formDirection,
          typeCode: created.code,
          title,
          amount: Number(formAmount),
          occurredAt: formOccurredAt?.toISOString(),
          notes,
          trainerId: customSubject === 'trainer' ? formTrainerId : undefined,
          clientId: customSubject === 'client' ? formClientId : undefined,
          allocation: customAllocation,
        });
        discard();
        const refresh: AddFinanceSuccessPayload['refresh'] = ['operations', 'types'];
        if (customSubject === 'trainer') refresh.push('salary');
        if (customSubject === 'client') refresh.push('memberships');
        onSuccess?.({ message: 'Операция сохранена', refresh });
        return true;
      }

      setError('Неизвестный тип операции');
      return false;
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось сохранить операцию');
      return false;
    } finally {
      setSavingAdd(false);
    }
  };

  const addDirty = open && addFormBaseline != null && isDirtyValue(addFormSnapshot(), addFormBaseline);
  const addUnsaved = useUnsavedClose({
    isDirty: Boolean(addDirty),
    onDiscard: discard,
    onSave: handleSaveOperation,
  });

  const onTypeChange = (code: string) => {
    setFormTypeCode(code);
    setFormTrainerId('');
    setFormClientId('');
    setFormMembershipId('');
    setFormTitle('');
    setFormAmount('');
    if (code !== CUSTOM_TYPE_VALUE) setNewTypeName('');
  };

  const needsTrainer = formTypeCode === 'salary' || formTypeCode === 'bonus';
  const showTitle =
    formTypeCode !== 'membership_issue' &&
    (formTypeCode === 'rent' ||
      formTypeCode === 'purchase' ||
      formTypeCode === 'advertising' ||
      formTypeCode === 'other' ||
      formTypeCode === 'salary' ||
      formTypeCode === 'bonus' ||
      isCustomType);

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ru}>
      <Dialog
        open={open}
        onClose={(_event, reason) => {
          if (reason === 'backdropClick' || reason === 'escapeKeyDown') {
            addUnsaved.requestClose(reason);
          }
        }}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: '16px',
            boxShadow: '0 24px 64px rgba(27, 36, 56, 0.2)',
            overflow: 'hidden',
            maxWidth: 720,
          },
        }}
      >
        <Box sx={{ px: 2.75, pt: 2.25, pb: 1.25, position: 'relative' }}>
          <IconButton
            onClick={() => !savingAdd && discard()}
            sx={{ position: 'absolute', top: 14, right: 14, color: '#8B93A7' }}
          >
            <Close />
          </IconButton>
          <Stack direction="row" spacing={1.25} alignItems="flex-start" sx={{ pr: 4 }}>
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: '12px',
                bgcolor: '#EEF4FF',
                color: colors.primary,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <PaymentsOutlined />
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 800, fontSize: 20, color: '#1B2438' }}>
                Добавить финансовую операцию
              </Typography>
              <Typography sx={{ fontSize: 13, fontWeight: 600, color: '#8B93A7', mt: 0.35 }}>
                Введите информацию о финансовой операции. Она будет отображена в отчётах.
              </Typography>
            </Box>
          </Stack>
        </Box>

        <Box sx={{ px: 2.75, pb: 1, maxHeight: '70vh', overflow: 'auto' }}>
          {error && (
            <Typography sx={{ color: '#DC2626', fontWeight: 650, fontSize: 13, mb: 1.5 }}>
              {error}
            </Typography>
          )}
          {refsLoading && (
            <Box display="flex" justifyContent="center" py={2}>
              <CircularProgress size={28} />
            </Box>
          )}

          <SectionHead icon={<InfoOutlined sx={{ fontSize: 18 }} />} title="Основная информация" />

          <Box sx={{ mb: 1.25 }}>
            <FieldLabel required>Тип операции</FieldLabel>
            <FormControl fullWidth size="small">
              <Select
                value={formTypeCode}
                onChange={(e) => onTypeChange(e.target.value)}
                sx={{ borderRadius: '10px', fontWeight: 650 }}
              >
                {ADD_OP_SYSTEM_TYPES.map((t) => (
                  <MenuItem key={t.code} value={t.code}>
                    {t.name}
                  </MenuItem>
                ))}
                <MenuItem value={CUSTOM_TYPE_VALUE}>Добавить тип…</MenuItem>
              </Select>
            </FormControl>
          </Box>

          {isCustomType && (
            <Box sx={{ mb: 1.25, display: 'grid', gap: 1.25 }}>
              <Box>
                <FieldLabel required>Название типа</FieldLabel>
                <TextField
                  size="small"
                  fullWidth
                  value={newTypeName}
                  onChange={(e) => setNewTypeName(e.target.value)}
                  placeholder="Например: Компенсация"
                  sx={fieldSx}
                />
              </Box>
              <FormControl fullWidth size="small">
                <FieldLabel>Субъект</FieldLabel>
                <Select
                  value={customSubject}
                  onChange={(e) => setCustomSubject(e.target.value as CustomSubject)}
                  sx={{ borderRadius: '10px', fontWeight: 650 }}
                >
                  <MenuItem value="trainer">Тренер</MenuItem>
                  <MenuItem value="client">Клиент</MenuItem>
                </Select>
              </FormControl>
              <FormControl fullWidth size="small">
                <FieldLabel>Куда начислять</FieldLabel>
                <Select
                  value={customAllocation}
                  onChange={(e) => setCustomAllocation(e.target.value as CustomAllocation)}
                  sx={{ borderRadius: '10px', fontWeight: 650 }}
                >
                  {customSubject === 'trainer'
                    ? [
                        <MenuItem key="accrued" value="accrued">
                          Начислено
                        </MenuItem>,
                        <MenuItem key="paid" value="paid">
                          Выплачено
                        </MenuItem>,
                      ]
                    : [
                        <MenuItem key="debit" value="debit">
                          Списать с баланса
                        </MenuItem>,
                        <MenuItem key="credit" value="credit">
                          Пополнить баланс
                        </MenuItem>,
                      ]}
                </Select>
              </FormControl>
            </Box>
          )}

          {formTypeCode === 'membership_issue' ? (
            <Box sx={{ mb: 1.25, display: 'grid', gap: 1.25 }}>
              <Box>
                <FieldLabel required>Клиент</FieldLabel>
                <FormControl fullWidth size="small">
                  <Select
                    value={formClientId}
                    displayEmpty
                    onChange={(e) => setFormClientId(e.target.value)}
                    sx={{ borderRadius: '10px', fontWeight: 650 }}
                    renderValue={(v) => {
                      if (!v) return <span style={{ color: '#8B93A7' }}>Выберите клиента</span>;
                      const c = clients.find((x) => x.id === v);
                      return c ? formatClientOptionLabel(c) : v;
                    }}
                  >
                    {clients.map((c) => (
                      <MenuItem key={c.id} value={c.id}>
                        {formatClientOptionLabel(c)}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>
              <Box>
                <FieldLabel required>Абонемент</FieldLabel>
                <FormControl fullWidth size="small">
                  <Select
                    value={formMembershipId}
                    displayEmpty
                    disabled={membershipCatalogLoading}
                    onChange={(e) => setFormMembershipId(e.target.value)}
                    sx={{ borderRadius: '10px', fontWeight: 650 }}
                    renderValue={(v) => {
                      if (!v) return <span style={{ color: '#8B93A7' }}>Выберите абонемент</span>;
                      const m = membershipCatalog.find((x) => x.id === v);
                      return m
                        ? `${m.name}${m.price != null ? ` — ${Number(m.price).toLocaleString('ru-RU')} ₽` : ''}`
                        : v;
                    }}
                  >
                    {membershipCatalog.map((m) => (
                      <MenuItem key={m.id} value={m.id}>
                        {m.name}
                        {m.price != null ? ` — ${Number(m.price).toLocaleString('ru-RU')} ₽` : ''}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>
              <Box>
                <FieldLabel required>С какого числа действует</FieldLabel>
                <DatePicker
                  value={formMembershipStartDate}
                  onChange={setFormMembershipStartDate}
                  format="dd.MM.yyyy"
                  slotProps={{ textField: { size: 'small', fullWidth: true, sx: fieldSx } }}
                />
              </Box>
              {formMembershipId && (
                <Typography sx={{ fontSize: 13, fontWeight: 650, color: '#8B93A7' }}>
                  Сумма с тарифа: {formatMoney(Number(formAmount) || 0)}
                </Typography>
              )}
            </Box>
          ) : (
            <>
              {(needsTrainer || (isCustomType && customSubject === 'trainer')) && (
                <Box sx={{ mb: 1.25 }}>
                  <FieldLabel required>Тренер</FieldLabel>
                  <Autocomplete
                    size="small"
                    options={trainers}
                    value={trainers.find((t) => t.id === formTrainerId) || null}
                    onChange={(_e, v) => setFormTrainerId(v?.id || '')}
                    getOptionLabel={(t) => trainerLabel(t)}
                    isOptionEqualToValue={(a, b) => a.id === b.id}
                    renderInput={(params) => (
                      <TextField {...params} placeholder="Поиск тренера…" sx={fieldSx} />
                    )}
                  />
                </Box>
              )}

              {isCustomType && customSubject === 'client' && (
                <Box sx={{ mb: 1.25 }}>
                  <FieldLabel required>Клиент</FieldLabel>
                  <FormControl fullWidth size="small">
                    <Select
                      value={formClientId}
                      displayEmpty
                      onChange={(e) => setFormClientId(e.target.value)}
                      sx={{ borderRadius: '10px', fontWeight: 650 }}
                      renderValue={(v) => {
                        if (!v) return <span style={{ color: '#8B93A7' }}>Выберите клиента</span>;
                        const c = clients.find((x) => x.id === v);
                        return c ? formatClientOptionLabel(c) : v;
                      }}
                    >
                      {clients.map((c) => (
                        <MenuItem key={c.id} value={c.id}>
                          {formatClientOptionLabel(c)}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Box>
              )}

              {showTitle && (
                <Box sx={{ mb: 1.25 }}>
                  <FieldLabel
                    required={
                      formTypeCode === 'rent' ||
                      formTypeCode === 'purchase' ||
                      formTypeCode === 'advertising' ||
                      formTypeCode === 'other'
                    }
                  >
                    Наименование операции
                  </FieldLabel>
                  <TextField
                    size="small"
                    fullWidth
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder={
                      formTypeCode === 'salary'
                        ? 'Период / подпись выплаты (необязательно)'
                        : 'Например: Аренда зала за октябрь'
                    }
                    sx={fieldSx}
                  />
                </Box>
              )}

              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                  gap: 1.25,
                  mb: 1.25,
                }}
              >
                <Box>
                  <FieldLabel required>Сумма</FieldLabel>
                  <TextField
                    size="small"
                    fullWidth
                    value={formAmount}
                    onChange={(e) => setFormAmount(e.target.value)}
                    placeholder="0"
                    sx={fieldSx}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Typography sx={{ fontWeight: 800, color: colors.primary }}>₽</Typography>
                        </InputAdornment>
                      ),
                    }}
                  />
                </Box>
                <Box>
                  <FieldLabel required>Дата и время</FieldLabel>
                  <DateTimePicker
                    value={formOccurredAt}
                    onChange={setFormOccurredAt}
                    format="dd.MM.yyyy HH:mm"
                    ampm={false}
                    slotProps={{
                      textField: {
                        size: 'small',
                        fullWidth: true,
                        sx: fieldSx,
                        InputProps: {
                          startAdornment: (
                            <InputAdornment position="start">
                              <CalendarMonthOutlined sx={{ fontSize: 18, color: colors.primary }} />
                            </InputAdornment>
                          ),
                        },
                      },
                    }}
                  />
                </Box>
              </Box>

              <Box sx={{ mb: 2 }}>
                <FieldLabel>Комментарий</FieldLabel>
                <TextField
                  fullWidth
                  multiline
                  minRows={2}
                  placeholder="Необязательно"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  sx={fieldSx}
                />
              </Box>
            </>
          )}
        </Box>

        <Box
          sx={{
            px: 2.75,
            py: 1.75,
            borderTop: '1px solid #EEF1F6',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 1.25,
            bgcolor: '#FAFBFD',
          }}
        >
          <Button
            onClick={() => !savingAdd && discard()}
            disabled={savingAdd}
            sx={{ textTransform: 'none', fontWeight: 700, color: '#8B93A7' }}
          >
            Отмена
          </Button>
          <Button
            variant="contained"
            disabled={savingAdd || !canSaveAddOperation}
            onClick={() => void handleSaveOperation()}
            startIcon={
              savingAdd ? (
                <CircularProgress size={16} color="inherit" />
              ) : (
                <CheckCircleOutline sx={{ fontSize: 18 }} />
              )
            }
            sx={{
              textTransform: 'none',
              fontWeight: 800,
              borderRadius: '10px',
              px: 2.25,
              bgcolor: colors.primary,
              boxShadow: 'none',
              '&:hover': { bgcolor: colors.primaryDark, boxShadow: 'none' },
            }}
          >
            Сохранить операцию
          </Button>
        </Box>
      </Dialog>

      <UnsavedChangesDialog
        open={addUnsaved.confirmOpen}
        onStay={addUnsaved.stay}
        onDiscard={addUnsaved.discard}
        onSave={addUnsaved.save}
        saving={savingAdd}
      />
    </LocalizationProvider>
  );
};

export default AddFinanceOperationDialog;
