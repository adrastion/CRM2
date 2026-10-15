import React, { useEffect, useState } from 'react';
import { Box, Button, Paper, Stack, Typography } from '@mui/material';
import { apiService } from '../../services/api';

const ROLE_LABELS: Record<string, string> = {
  OWNER: 'Владелец',
  ADMIN: 'Администратор',
  TRAINER: 'Тренер',
  CLIENT: 'Клиент',
  PARENT: 'Родитель',
  MARKETER: 'Маркетолог',
  TESTER: 'Тестировщик',
  PLATFORM_STAFF: 'Сотрудник платформы',
};

const ROLES = Object.keys(ROLE_LABELS);

function enterSandbox(data: { sessionId: string; role: string; dashboardPath: string; keys: Record<string, string> }) {
  const saToken = localStorage.getItem('superAdminToken') || '';
  const saUser = localStorage.getItem('superAdmin') || '';
  sessionStorage.setItem('saTokenBackup', saToken);
  sessionStorage.setItem('saUserBackup', saUser);
  sessionStorage.setItem('saSandboxActive', '1');
  sessionStorage.setItem('saSandboxSessionId', data.sessionId);
  sessionStorage.setItem('saSandboxRole', data.role);
  const drop = [
    'superAdminToken', 'superAdmin', 'token', 'user', 'tenant',
    'clientToken', 'client', 'clientTenant', 'userType', 'clientApproved',
    'marketerToken', 'marketer', 'marketerTenant',
    'testerToken', 'tester', 'platformStaffToken', 'platformStaff',
  ];
  drop.forEach((k) => localStorage.removeItem(k));
  Object.entries(data.keys).forEach(([k, v]) => {
    if (v === 'null') localStorage.removeItem(k);
    else localStorage.setItem(k, v);
  });
  window.location.assign(data.dashboardPath);
}

const SaSandboxTab: React.FC = () => {
  const [sessions, setSessions] = useState<any[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    const data = await apiService.listTestSessions();
    setSessions(data.sessions || []);
  };

  useEffect(() => {
    load();
  }, []);

  const savedFor = (role: string) => sessions.find((s) => s.role === role && s.saved);

  return (
    <Box sx={{ maxWidth: 720 }}>
      <Typography variant="h5" gutterBottom>
        Тестовые кабинеты
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Отдельные тестовые учётки. При выходе можно сохранить сессию и открыть её снова.
      </Typography>
      <Stack spacing={1.5}>
        {ROLES.map((role) => {
          const saved = savedFor(role);
          return (
            <Paper key={role} sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
              <Box>
                <Typography fontWeight={600}>{ROLE_LABELS[role]}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {saved ? 'Сессия сохранена' : 'Сохранённой сессии нет'}
                </Typography>
              </Box>
              <Stack direction="row" spacing={1}>
                {saved ? (
                  <>
                    <Button
                      variant="contained"
                      disabled={busy === role}
                      onClick={async () => {
                        setBusy(role);
                        const data = await apiService.enterTestSession({ sessionId: saved.id });
                        enterSandbox(data);
                      }}
                    >
                      Открыть
                    </Button>
                    <Button
                      color="error"
                      disabled={busy === role}
                      onClick={async () => {
                        setBusy(role);
                        await apiService.deleteTestSession(saved.id);
                        await load();
                        setBusy(null);
                      }}
                    >
                      Удалить
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="outlined"
                    disabled={busy === role}
                    onClick={async () => {
                      setBusy(role);
                      const data = await apiService.enterTestSession({ role });
                      enterSandbox(data);
                    }}
                  >
                    Войти
                  </Button>
                )}
              </Stack>
            </Paper>
          );
        })}
      </Stack>
    </Box>
  );
};

export default SaSandboxTab;
