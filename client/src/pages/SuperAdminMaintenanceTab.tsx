import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  FormControlLabel,
  Paper,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank';
import CheckBoxIcon from '@mui/icons-material/CheckBox';
import { apiService } from '../services/api';

type AccountOption = {
  email: string;
  name: string;
  roleLabel: string;
};

const checkboxIcon = <CheckBoxOutlineBlankIcon fontSize="small" />;
const checkboxCheckedIcon = <CheckBoxIcon fontSize="small" />;

/**
 * Секция SA: техобслуживание + режим тестирования.
 * Список доступа — выбор из существующих аккаунтов платформы.
 */
const SuperAdminMaintenanceTab: React.FC = () => {
  const [maintenanceEnabled, setMaintenanceEnabled] = useState(false);
  const [testingEnabled, setTestingEnabled] = useState(false);
  const [closedTestingEnabled, setClosedTestingEnabled] = useState(false);
  const [selectedEmails, setSelectedEmails] = useState<string[]>([]);
  const [candidates, setCandidates] = useState<AccountOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingMaintenance, setSavingMaintenance] = useState(false);
  const [savingTesting, setSavingTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [m, t, accounts, publicStatus] = await Promise.all([
        apiService.getAdminMaintenance(),
        apiService.getAdminTestingMode(),
        apiService.getTestingAccountCandidates(),
        apiService.getMaintenanceStatus(),
      ]);
      setMaintenanceEnabled(Boolean(m?.enabled));
      setTestingEnabled(Boolean(t?.enabled));
      setClosedTestingEnabled(
        Boolean(t?.closedTesting?.enabled ?? publicStatus?.closedTesting?.enabled)
      );
      setSelectedEmails(t?.allowlist || []);
      setCandidates(accounts || []);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось загрузить статус');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const options = useMemo(() => {
    const byEmail = new Map<string, AccountOption>();
    for (const c of candidates) {
      byEmail.set(c.email, c);
    }
    // Email из allowlist, которых уже нет в БД — оставляем в выборе
    for (const email of selectedEmails) {
      if (!byEmail.has(email)) {
        byEmail.set(email, {
          email,
          name: email,
          roleLabel: 'Нет в каталоге',
        });
      }
    }
    return Array.from(byEmail.values()).sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  }, [candidates, selectedEmails]);

  const selectedOptions = useMemo(
    () => options.filter((o) => selectedEmails.includes(o.email)),
    [options, selectedEmails]
  );

  const onToggleMaintenance = async (_: React.ChangeEvent<HTMLInputElement>, checked: boolean) => {
    setSavingMaintenance(true);
    setError(null);
    setSuccess(null);
    try {
      const data = await apiService.updateAdminMaintenance(checked);
      setMaintenanceEnabled(Boolean(data.enabled));
      if (checked) {
        sessionStorage.setItem('maintenanceMode', '1');
        setSuccess('Режим технических работ включён. Сайт недоступен всем, кроме супер-админа.');
      } else {
        sessionStorage.removeItem('maintenanceMode');
        setSuccess('Режим технических работ выключен.');
      }
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось сохранить');
    } finally {
      setSavingMaintenance(false);
    }
  };

  const onToggleTesting = async (_: React.ChangeEvent<HTMLInputElement>, checked: boolean) => {
    setSavingTesting(true);
    setError(null);
    setSuccess(null);
    try {
      const data = await apiService.updateAdminTestingMode(checked, selectedEmails);
      setTestingEnabled(Boolean(data.enabled));
      setSelectedEmails(data.allowlist || []);
      if (checked) {
        sessionStorage.setItem('testingMode', '1');
        sessionStorage.setItem('testingModeAccess', '1');
        setSuccess('Режим тестирования включён. Доступ только у SA и выбранных аккаунтов.');
      } else {
        sessionStorage.removeItem('testingMode');
        sessionStorage.removeItem('testingModeAccess');
        setSuccess('Режим тестирования выключен.');
      }
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось сохранить');
    } finally {
      setSavingTesting(false);
    }
  };

  const onSaveAllowlist = async () => {
    setSavingTesting(true);
    setError(null);
    setSuccess(null);
    try {
      const data = await apiService.updateAdminTestingMode(testingEnabled, selectedEmails);
      setSelectedEmails(data.allowlist || []);
      setSuccess('Список доступов сохранён.');
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось сохранить список');
    } finally {
      setSavingTesting(false);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" p={4}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 720 }}>
      <Typography variant="h5" gutterBottom>
        Техобслуживание и тестирование
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Режим технических работ полностью закрывает сайт. Режим тестирования оставляет доступ
        супер-админу и выбранным аккаунтам.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}
      {closedTestingEnabled && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Включён режим закрытого тестирования (управляется из консоли:{' '}
          <code>npm run closed-testing -- off</code>). Вход на сайт недоступен. Тумблеры ниже
          заблокированы, пока режим не выключат.
        </Alert>
      )}

      <Paper sx={{ p: 3, mb: 2 }}>
        <FormControlLabel
          control={
            <Switch
              checked={maintenanceEnabled}
              onChange={onToggleMaintenance}
              disabled={savingMaintenance || closedTestingEnabled}
              color="warning"
            />
          }
          label="Режим технических работ"
        />
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          {maintenanceEnabled
            ? 'Сейчас сайт закрыт для всех, кроме супер-админа.'
            : 'Сайт не в режиме техобслуживания.'}
        </Typography>
      </Paper>

      <Paper sx={{ p: 3 }}>
        <FormControlLabel
          control={
            <Switch
              checked={testingEnabled}
              onChange={onToggleTesting}
              disabled={savingTesting || maintenanceEnabled || closedTestingEnabled}
              color="primary"
            />
          }
          label="Режим тестирования"
        />
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1, mb: 2 }}>
          {closedTestingEnabled
            ? 'Закрытое тестирование активнее обычного: вход запрещён, доступ только у уже авторизованных allowlist/SA.'
            : maintenanceEnabled
              ? 'Пока включены технические работы, режим тестирования не применяется.'
              : testingEnabled
                ? 'Сайт доступен только супер-админу и аккаунтам из списка ниже.'
                : 'Режим тестирования выключен.'}
        </Typography>

        <Autocomplete
          multiple
          disableCloseOnSelect
          options={options}
          value={selectedOptions}
          onChange={(_, value) => setSelectedEmails(value.map((v) => v.email))}
          getOptionLabel={(o) => `${o.name} (${o.email})`}
          isOptionEqualToValue={(a, b) => a.email === b.email}
          filterOptions={(opts, state) => {
            const q = state.inputValue.trim().toLowerCase();
            if (!q) return opts;
            return opts.filter(
              (o) =>
                o.email.includes(q) ||
                o.name.toLowerCase().includes(q) ||
                o.roleLabel.toLowerCase().includes(q)
            );
          }}
          disabled={savingTesting || closedTestingEnabled}
          renderOption={(props, option, { selected }) => (
            <li {...props} key={option.email}>
              <Checkbox
                icon={checkboxIcon}
                checkedIcon={checkboxCheckedIcon}
                style={{ marginRight: 8 }}
                checked={selected}
              />
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="body2" noWrap>
                  {option.name}
                </Typography>
                <Typography variant="caption" color="text.secondary" noWrap>
                  {option.email} · {option.roleLabel}
                </Typography>
              </Box>
            </li>
          )}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Разрешённые аккаунты"
              placeholder="Поиск по имени или email"
              helperText="Выберите существующие аккаунты. Супер-админ всегда имеет доступ."
            />
          )}
        />

        <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            variant="outlined"
            onClick={() => void onSaveAllowlist()}
            disabled={savingTesting || closedTestingEnabled}
            sx={{ textTransform: 'none' }}
          >
            Сохранить список
          </Button>
        </Box>
      </Paper>
    </Box>
  );
};

export default SuperAdminMaintenanceTab;
