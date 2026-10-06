import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  InputAdornment,
  InputLabel,
  MenuItem,
  Radio,
  RadioGroup,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { DatePicker, DateTimePicker } from '@mui/x-date-pickers';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { ru } from 'date-fns/locale';
import { apiService } from '../../services/api';
import { Client, FinanceDirection, Trainer } from '../../types';
import { colors, typography } from '../../theme/tokens';
import UnsavedChangesDialog from '../common/UnsavedChangesDialog';
import { isDirtyValue, useUnsavedClose } from '../../hooks/useUnsavedClose';

const ADD_OP_SYSTEM_TYPES: Array<{ code: string; name: string }> = [
  { code: 'rent', name: 'Аренда' },
  { code: 'membership_issue', name: 'Выдача абонемента' },
  { code: 'salary', name: 'Зарплата' },
  { code: 'bonus', name: 'Премия' },
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

export type AddFinanceSuccessPayload = {
  message: string;
  refresh?: Array<'operations' | 'salary' | 'memberships' | 'types'>;
};

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess?: (payload: AddFinanceSuccessPayload) => void;
}

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
          notes: formNotes || undefined,
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
          notes: formNotes || undefined,
          trainerId: formTrainerId,
        });
        discard();
        onSuccess?.({ message: 'Премия начислена', refresh: ['operations', 'salary'] });
        return true;
      }

      if (formTypeCode === 'rent') {
        await apiService.createFinanceOperation({
          direction: 'expense',
          typeCode: 'rent',
          title: formTitle.trim(),
          amount: Number(formAmount),
          occurredAt: formOccurredAt?.toISOString(),
          notes: formNotes || undefined,
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
          notes: formNotes || undefined,
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

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ru}>
      <Dialog
        open={open}
        onClose={(_event, reason) => {
          if (reason === 'backdropClick' || reason === 'escapeKeyDown') {
            addUnsaved.requestClose(reason);
          }
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Добавить операцию</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {error && (
              <Alert severity="error" onClose={() => setError(null)}>
                {error}
              </Alert>
            )}
            {refsLoading && (
              <Box display="flex" justifyContent="center">
                <CircularProgress size={28} />
              </Box>
            )}
            <FormControl fullWidth>
              <InputLabel>Тип операции</InputLabel>
              <Select
                label="Тип операции"
                value={formTypeCode}
                onChange={(e) => {
                  const v = e.target.value;
                  setFormTypeCode(v);
                  setFormTrainerId('');
                  setFormClientId('');
                  setFormMembershipId('');
                  setFormTitle('');
                  setFormAmount('');
                  if (v !== CUSTOM_TYPE_VALUE) setNewTypeName('');
                }}
              >
                {ADD_OP_SYSTEM_TYPES.map((t) => (
                  <MenuItem key={t.code} value={t.code}>
                    {t.name}
                  </MenuItem>
                ))}
                <MenuItem value={CUSTOM_TYPE_VALUE}>Добавить тип…</MenuItem>
              </Select>
            </FormControl>

            {isCustomType && (
              <>
                <TextField
                  label="Название типа"
                  fullWidth
                  value={newTypeName}
                  onChange={(e) => setNewTypeName(e.target.value)}
                  placeholder="Например: Компенсация"
                />
                <FormControl>
                  <Typography sx={{ mb: 0.5 }}>Субъект</Typography>
                  <RadioGroup
                    row
                    value={customSubject}
                    onChange={(e) => setCustomSubject(e.target.value as CustomSubject)}
                  >
                    <FormControlLabel value="trainer" control={<Radio />} label="Тренер" />
                    <FormControlLabel value="client" control={<Radio />} label="Клиент" />
                  </RadioGroup>
                </FormControl>
                {customSubject === 'trainer' ? (
                  <FormControl fullWidth>
                    <InputLabel>Тренер</InputLabel>
                    <Select
                      label="Тренер"
                      value={formTrainerId}
                      onChange={(e) => setFormTrainerId(e.target.value)}
                    >
                      {trainers.map((t) => (
                        <MenuItem key={t.id} value={t.id}>
                          {t.user?.lastName} {t.user?.firstName}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                ) : (
                  <FormControl fullWidth>
                    <InputLabel>Клиент</InputLabel>
                    <Select
                      label="Клиент"
                      value={formClientId}
                      onChange={(e) => setFormClientId(e.target.value)}
                    >
                      {clients.map((c) => (
                        <MenuItem key={c.id} value={c.id}>
                          {formatClientOptionLabel(c)}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}
                <FormControl fullWidth>
                  <InputLabel>Куда начислять</InputLabel>
                  <Select
                    label="Куда начислять"
                    value={customAllocation}
                    onChange={(e) => setCustomAllocation(e.target.value as CustomAllocation)}
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
              </>
            )}

            {formTypeCode === 'membership_issue' && (
              <>
                <FormControl fullWidth>
                  <InputLabel>Клиент</InputLabel>
                  <Select
                    label="Клиент"
                    value={formClientId}
                    onChange={(e) => setFormClientId(e.target.value)}
                  >
                    {clients.map((c) => (
                      <MenuItem key={c.id} value={c.id}>
                        {formatClientOptionLabel(c)}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <FormControl fullWidth>
                  <InputLabel>Абонемент</InputLabel>
                  <Select
                    label="Абонемент"
                    value={formMembershipId}
                    onChange={(e) => setFormMembershipId(e.target.value)}
                    disabled={membershipCatalogLoading}
                  >
                    {membershipCatalog.map((m) => (
                      <MenuItem key={m.id} value={m.id}>
                        {m.name}
                        {m.price != null ? ` — ${Number(m.price).toLocaleString('ru-RU')} ₽` : ''}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <DatePicker
                  label="С какого числа действует абонемент"
                  value={formMembershipStartDate}
                  onChange={setFormMembershipStartDate}
                  slotProps={{ textField: { fullWidth: true, required: true } }}
                />
                {membershipCatalogLoading && (
                  <Box display="flex" justifyContent="center">
                    <CircularProgress size={24} />
                  </Box>
                )}
              </>
            )}

            {(formTypeCode === 'salary' || formTypeCode === 'bonus') && (
              <FormControl fullWidth>
                <InputLabel>Тренер</InputLabel>
                <Select
                  label="Тренер"
                  value={formTrainerId}
                  onChange={(e) => setFormTrainerId(e.target.value)}
                >
                  {trainers.map((t) => (
                    <MenuItem key={t.id} value={t.id}>
                      {t.user?.lastName} {t.user?.firstName}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            {formTypeCode !== 'membership_issue' && (
              <TextField
                label="Наименование операции"
                fullWidth
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                required={formTypeCode === 'rent'}
              />
            )}

            {formTypeCode !== 'membership_issue' && (
              <TextField
                label="Сумма"
                fullWidth
                value={formAmount}
                onChange={(e) => setFormAmount(e.target.value)}
                InputProps={{ endAdornment: <InputAdornment position="end">₽</InputAdornment> }}
                required
              />
            )}

            {formTypeCode === 'membership_issue' && formMembershipId && (
              <Typography sx={{ color: colors.textMuted, fontSize: typography.label }}>
                Сумма с тарифа: {formatMoney(Number(formAmount) || 0)}
              </Typography>
            )}

            {formTypeCode !== 'membership_issue' && (
              <DateTimePicker
                label="Дата и время"
                value={formOccurredAt}
                onChange={setFormOccurredAt}
                slotProps={{ textField: { fullWidth: true } }}
              />
            )}
            <TextField
              label="Комментарий"
              fullWidth
              multiline
              minRows={2}
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={discard} sx={{ textTransform: 'none' }} disabled={savingAdd}>
            Отмена
          </Button>
          <Button
            variant="contained"
            disabled={!canSaveAddOperation || savingAdd || refsLoading}
            onClick={() => void handleSaveOperation()}
            sx={{ textTransform: 'none', bgcolor: colors.primary }}
          >
            {savingAdd ? 'Сохранение…' : 'Сохранить операцию'}
          </Button>
        </DialogActions>
      </Dialog>
      <UnsavedChangesDialog
        open={addUnsaved.confirmOpen}
        saving={addUnsaved.saving}
        onSave={addUnsaved.save}
        onDiscard={addUnsaved.discard}
        onStay={addUnsaved.stay}
      />
    </LocalizationProvider>
  );
};

export default AddFinanceOperationDialog;
