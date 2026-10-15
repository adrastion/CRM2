import React, { useState } from 'react';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from '@mui/material';
import { apiService } from '../services/api';

const ROLE_KEYS = [
  'token', 'user', 'tenant',
  'clientToken', 'client', 'clientTenant', 'userType', 'clientApproved',
  'marketerToken', 'marketer', 'marketerTenant',
  'testerToken', 'tester', 'platformStaffToken', 'platformStaff',
];

/** Кнопка выхода из тестовой сессии с вопросом «Сохранить сессию?». */
const SandboxExitBanner: React.FC = () => {
  const active = sessionStorage.getItem('saSandboxActive') === '1';
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!active) return null;

  const finish = async (save: boolean) => {
    setBusy(true);
    const backup = sessionStorage.getItem('saTokenBackup') || '';
    const user = sessionStorage.getItem('saUserBackup') || '';
    const sessionId = sessionStorage.getItem('saSandboxSessionId') || '';
    try {
      if (sessionId && backup) {
        if (save) await apiService.saveTestSession(sessionId, backup);
        else await apiService.deleteTestSession(sessionId, backup);
      }
    } catch {
      /* сессия всё равно закрывается */
    }
    ROLE_KEYS.forEach((k) => localStorage.removeItem(k));
    if (backup) localStorage.setItem('superAdminToken', backup);
    if (user) localStorage.setItem('superAdmin', user);
    sessionStorage.removeItem('saTokenBackup');
    sessionStorage.removeItem('saUserBackup');
    sessionStorage.removeItem('saSandboxActive');
    sessionStorage.removeItem('saSandboxSessionId');
    sessionStorage.removeItem('saSandboxRole');
    window.location.assign('/admin/dashboard?section=sandbox');
  };

  return (
    <>
      <Box
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: 1500,
          bgcolor: 'secondary.main',
          color: 'secondary.contrastText',
          px: 2,
          py: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2,
        }}
      >
        <Typography variant="body2">Тестовый кабинет</Typography>
        <Button size="small" variant="contained" color="inherit" onClick={() => setOpen(true)}>
          Выйти из теста
        </Button>
      </Box>
      <Dialog open={open} onClose={() => setOpen(false)}>
        <DialogTitle>Сохранить сессию?</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            Сохранённую сессию можно открыть снова. Если не сохранять, она удалится.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button disabled={busy} onClick={() => finish(false)}>Не сохранять</Button>
          <Button disabled={busy} variant="contained" onClick={() => finish(true)}>Сохранить</Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default SandboxExitBanner;
