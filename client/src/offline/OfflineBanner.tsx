import React, { useEffect, useState } from 'react';
import { Alert, Box, Button, Collapse } from '@mui/material';
import CloudOffIcon from '@mui/icons-material/CloudOff';
import SyncIcon from '@mui/icons-material/Sync';
import {
  flushOutbox,
  getOfflineStatus,
  pullOfflineSnapshots,
  subscribeOfflineStatus,
  type OfflineStatus,
} from './sync';

const OfflineBanner: React.FC = () => {
  const [status, setStatus] = useState<OfflineStatus>(getOfflineStatus());
  const [busy, setBusy] = useState(false);

  useEffect(() => subscribeOfflineStatus(setStatus), []);

  const show = !status.online || status.pending > 0;
  if (!show) return null;

  return (
    <Collapse in={show}>
      <Box sx={{ px: { xs: 1, sm: 2 }, pt: 1 }}>
        <Alert
          severity={status.online ? 'info' : 'warning'}
          icon={status.online ? <SyncIcon /> : <CloudOffIcon />}
          action={
            status.online && status.pending > 0 ? (
              <Button
                color="inherit"
                size="small"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await flushOutbox();
                    await pullOfflineSnapshots();
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Синхронизировать
              </Button>
            ) : null
          }
          sx={{ py: 0.5 }}
        >
          {!status.online
            ? 'Нет сети — доступны кэш календаря, контактов и очередь посещаемости'
            : `Ожидают отправки: ${status.pending}`}
        </Alert>
      </Box>
    </Collapse>
  );
};

export default OfflineBanner;
