import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  Paper,
} from '@mui/material';
import { Add, Delete, Edit } from '@mui/icons-material';
import { apiService } from '../../services/api';

const emptyForm = {
  name: '',
  email: '',
  phone: '',
  password: '',
  isActive: true,
};

/** Управление админами промокодов школы (OWNER/ADMIN). */
const PromoCodeAdminsSettings: React.FC = () => {
  const [list, setList] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [dialog, setDialog] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    setError('');
    try {
      const res = await apiService.getPromoCodeAdmins();
      setList(res.data || []);
    } catch (e: any) {
      setError(e.response?.data?.error || e.message || 'Не удалось загрузить админов промокодов');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    setError('');
    setSuccess('');
    try {
      const payload: any = {
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim() || undefined,
        isActive: form.isActive,
      };
      if (form.password) payload.password = form.password;
      if (editing) {
        await apiService.updatePromoCodeAdmin(editing.id, payload);
        setSuccess('Админ промокодов обновлён');
      } else {
        if (!form.password || form.password.length < 6) {
          setError('Укажите пароль (мин. 6 символов)');
          return;
        }
        payload.password = form.password;
        await apiService.createPromoCodeAdmin(payload);
        setSuccess('Админ промокодов создан');
      }
      setDialog(false);
      setEditing(null);
      setForm(emptyForm);
      await load();
    } catch (e: any) {
      setError(e.response?.data?.error || e.message || 'Ошибка сохранения');
    }
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Box>
          <Typography variant="h6">Админы промокодов</Typography>
          <Typography variant="body2" color="text.secondary">
            Отдельный вход для управления маркетологами и промокодами школы
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => {
            setEditing(null);
            setForm(emptyForm);
            setDialog(true);
          }}
        >
          Добавить
        </Button>
      </Box>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>
          {success}
        </Alert>
      )}
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Имя</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Телефон</TableCell>
              <TableCell>Статус</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {list.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5}>
                  <Typography color="text.secondary">Пока нет админов промокодов</Typography>
                </TableCell>
              </TableRow>
            ) : (
              list.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>{a.name}</TableCell>
                  <TableCell>{a.email}</TableCell>
                  <TableCell>{a.phone || '—'}</TableCell>
                  <TableCell>
                    <Chip size="small" label={a.isActive ? 'Активен' : 'Выкл'} color={a.isActive ? 'success' : 'default'} />
                  </TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      onClick={() => {
                        setEditing(a);
                        setForm({
                          name: a.name,
                          email: a.email,
                          phone: a.phone || '',
                          password: '',
                          isActive: a.isActive,
                        });
                        setDialog(true);
                      }}
                    >
                      <Edit fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      color="error"
                      onClick={async () => {
                        if (!window.confirm('Удалить админа промокодов?')) return;
                        await apiService.deletePromoCodeAdmin(a.id);
                        await load();
                      }}
                    >
                      <Delete fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={dialog} onClose={() => setDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? 'Редактировать' : 'Новый админ промокодов'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <TextField label="Имя" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} fullWidth />
          <TextField label="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} fullWidth />
          <TextField label="Телефон" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} fullWidth />
          <TextField
            label={editing ? 'Новый пароль (необязательно)' : 'Пароль'}
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            fullWidth
          />
          <FormControlLabel
            control={<Switch checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />}
            label="Активен"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialog(false)}>Отмена</Button>
          <Button variant="contained" onClick={save}>
            Сохранить
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PromoCodeAdminsSettings;
