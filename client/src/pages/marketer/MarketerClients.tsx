import React, { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { apiService } from '../../services/api';

const MarketerClients: React.FC = () => {
  const [tab, setTab] = useState(0);
  const [leads, setLeads] = useState<any[]>([]);
  const [schools, setSchools] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [leadOpen, setLeadOpen] = useState(false);
  const [claimOpen, setClaimOpen] = useState(false);
  const [notes, setNotes] = useState('');
  const [claimCode, setClaimCode] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const data = await apiService.getMarketerClients();
      setLeads(data.leads || []);
      setSchools(data.schools || []);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const createLead = async () => {
    try {
      setSaving(true);
      await apiService.createMarketerLead({ notes, status: 'NEW', source: 'MANUAL' });
      setLeadOpen(false);
      setNotes('');
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось создать лид');
    } finally {
      setSaving(false);
    }
  };

  const claim = async () => {
    try {
      setSaving(true);
      await apiService.claimMarketerClient(claimCode.trim());
      setClaimOpen(false);
      setClaimCode('');
      setTab(1);
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось закрепить школу');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py={6}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }} flexWrap="wrap" gap={1}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          Клиенты
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" onClick={() => setClaimOpen(true)} sx={{ textTransform: 'none' }}>
            Закрепить школу
          </Button>
          <Button variant="contained" onClick={() => setLeadOpen(true)} sx={{ textTransform: 'none' }}>
            Добавить лид
          </Button>
        </Stack>
      </Stack>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label={`Лиды (${leads.length})`} sx={{ textTransform: 'none' }} />
        <Tab label={`Школы (${schools.length})`} sx={{ textTransform: 'none' }} />
      </Tabs>

      {tab === 0 && (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Код</TableCell>
              <TableCell>Контакты</TableCell>
              <TableCell>Статус</TableCell>
              <TableCell>Источник</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {leads.map((l) => (
              <TableRow key={l.id} hover>
                <TableCell>{l.displayCode}</TableCell>
                <TableCell>
                  {[l.maskedName, l.maskedEmail, l.maskedPhone].filter(Boolean).join(' · ') || '—'}
                </TableCell>
                <TableCell>
                  <Chip size="small" label={l.status} />
                </TableCell>
                <TableCell>{l.source}</TableCell>
                <TableCell>
                  <Button component={RouterLink} to={`/marketer/clients/${l.id}`} size="small" sx={{ textTransform: 'none' }}>
                    Карточка
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {leads.length === 0 && (
              <TableRow>
                <TableCell colSpan={5}>
                  <Typography color="text.secondary">Лидов пока нет</Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}

      {tab === 1 && (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Код</TableCell>
              <TableCell>Тариф</TableCell>
              <TableCell>Обслуживание</TableCell>
              <TableCell>С</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {schools.map((s) => (
              <TableRow key={s.id} hover>
                <TableCell>{s.displayCode}</TableCell>
                <TableCell>{s.planType}</TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    color={s.status === 'active' ? 'success' : 'default'}
                    label={s.status === 'active' ? 'Активное' : 'Бесплатное'}
                  />
                </TableCell>
                <TableCell>{new Date(s.linkedAt).toLocaleDateString('ru-RU')}</TableCell>
                <TableCell>
                  <Button component={RouterLink} to={`/marketer/clients/${s.id}`} size="small" sx={{ textTransform: 'none' }}>
                    Карточка
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {schools.length === 0 && (
              <TableRow>
                <TableCell colSpan={5}>
                  <Typography color="text.secondary">Школ пока нет — они появятся по реферальной ссылке</Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}

      <Dialog open={leadOpen} onClose={() => setLeadOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Новый лид</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Полные контакты в интерфейсе показываются только в маске. Код сгенерируется автоматически.
          </Typography>
          <TextField
            fullWidth
            multiline
            minRows={3}
            label="Заметка"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLeadOpen(false)} sx={{ textTransform: 'none' }}>
            Отмена
          </Button>
          <Button variant="contained" disabled={saving} onClick={createLead} sx={{ textTransform: 'none' }}>
            Создать
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={claimOpen} onClose={() => setClaimOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Закрепить школу</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Subdomain школы или код рефералки"
            value={claimCode}
            onChange={(e) => setClaimCode(e.target.value)}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setClaimOpen(false)} sx={{ textTransform: 'none' }}>
            Отмена
          </Button>
          <Button variant="contained" disabled={saving || !claimCode.trim()} onClick={claim} sx={{ textTransform: 'none' }}>
            Закрепить
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default MarketerClients;
