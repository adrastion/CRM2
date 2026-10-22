import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  TextField,
  Typography,
} from '@mui/material';
import { apiService } from '../../services/api';
import { Membership } from '../../types';
import { colors, radii } from '../../theme/tokens';

interface AssignMembershipDialogProps {
  membership: Membership | null;
  open: boolean;
  onClose: () => void;
  onAssigned: () => void | Promise<void>;
}

const AssignMembershipDialog: React.FC<AssignMembershipDialogProps> = ({
  membership,
  open,
  onClose,
  onAssigned,
}) => {
  const [clients, setClients] = useState<any[]>([]);
  const [clientId, setClientId] = useState('');
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setClientId('');
    setSearch('');
    setStartDate(new Date().toISOString().slice(0, 10));
    setError('');
    setLoading(true);
    apiService
      .getClients({ limit: 500, isActive: true }, undefined, false)
      .then((response) => setClients(response.data || []))
      .catch((err: any) =>
        setError(err?.response?.data?.error || 'Не удалось загрузить список клиентов')
      )
      .finally(() => setLoading(false));
  }, [open]);

  const filteredClients = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return clients;
    return clients.filter((client) =>
      [client.lastName, client.firstName, client.middleName, client.phone]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(query)
    );
  }, [clients, search]);

  const handleAssign = async () => {
    if (!membership || !clientId || !startDate) return;
    setSaving(true);
    setError('');
    try {
      await apiService.createClientMembership({
        clientId,
        membershipId: membership.id,
        startDate: new Date(`${startDate}T00:00:00`).toISOString(),
      });
      await onAssigned();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Не удалось назначить абонемент');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={saving ? undefined : onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { borderRadius: `${radii.panel}px` } }}
    >
      <DialogTitle sx={{ fontWeight: 800 }}>Назначить абонемент</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 0.5 }}>
          <Box
            sx={{
              p: 1.5,
              borderRadius: `${radii.button}px`,
              bgcolor: 'rgba(47,107,255,0.08)',
            }}
          >
            <Typography sx={{ fontWeight: 700, color: colors.text }}>
              {membership?.name}
            </Typography>
            <Typography sx={{ fontSize: 12, color: colors.textHint }}>
              {membership ? `${Number(membership.price).toLocaleString('ru-RU')} ₽` : ''}
            </Typography>
          </Box>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField
            size="small"
            label="Поиск клиента"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <TextField
            select
            size="small"
            label="Клиент"
            value={clientId}
            onChange={(event) => setClientId(event.target.value)}
            disabled={loading}
            helperText={loading ? 'Загрузка…' : undefined}
          >
            {filteredClients.map((client) => (
              <MenuItem key={client.id} value={client.id}>
                {[client.lastName, client.firstName, client.middleName].filter(Boolean).join(' ')}
                {client.phone ? ` · ${client.phone}` : ''}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            size="small"
            type="date"
            label="Дата начала"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
            InputLabelProps={{ shrink: true }}
          />
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} disabled={saving} sx={{ textTransform: 'none' }}>
          Отмена
        </Button>
        <Button
          variant="contained"
          onClick={handleAssign}
          disabled={saving || !clientId || !startDate || membership?.category === 'GROUP'}
          sx={{ textTransform: 'none', borderRadius: `${radii.button}px`, boxShadow: 'none' }}
        >
          {saving ? 'Назначение…' : 'Назначить'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AssignMembershipDialog;
