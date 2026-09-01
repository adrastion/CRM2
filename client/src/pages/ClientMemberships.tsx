import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import { Add, Delete, CheckCircle } from '@mui/icons-material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { apiService } from '../services/api';
import ClientNameLink from '../components/ClientNameLink';
import { Client, Membership } from '../types';

interface ClientMembership {
  id: string;
  clientId: string;
  membershipId: string;
  startDate: string;
  endDate?: string;
  visitsUsed: number;
  visitsTotal?: number;
  isActive: boolean;
  client?: Client;
  membership?: Membership;
}

const ClientMemberships: React.FC = () => {
  const [memberships, setMemberships] = useState<ClientMembership[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [membershipTypes, setMembershipTypes] = useState<Membership[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [formData, setFormData] = useState({
    clientId: '',
    membershipId: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [membershipsRes, clientsRes, membershipTypesRes] = await Promise.all([
        apiService.getClientMemberships(),
        apiService.getClients(),
        apiService.getMemberships().catch(() => ({ data: [] })),
      ]);
      setMemberships(membershipsRes.data || []);
      setClients(clientsRes.data);
      setMembershipTypes(membershipTypesRes.data || []);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка загрузки данных');
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateMembership = async () => {
    try {
      if (!formData.clientId || !formData.membershipId) {
        alert('Пожалуйста, выберите клиента и тип абонемента');
        return;
      }

      await apiService.createClientMembership(formData);
      await fetchData();
      setOpenDialog(false);
      setFormData({
        clientId: '',
        membershipId: '',
      });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка создания абонемента');
      console.error('Error creating membership:', err);
    }
  };

  const handleMarkVisit = async (membershipId: string) => {
    try {
      await apiService.markVisitUsed(membershipId);
      await fetchData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка отметки посещения');
      console.error('Error marking visit:', err);
    }
  };

  const handleDeleteMembership = async (membershipId: string) => {
    if (window.confirm('Вы уверены, что хотите удалить этот абонемент?')) {
      try {
        await apiService.deleteClientMembership(membershipId);
        await fetchData();
      } catch (err: any) {
        setError(err.response?.data?.error || 'Ошибка удаления абонемента');
        console.error('Error deleting membership:', err);
      }
    }
  };

  const isExpired = (membership: ClientMembership): boolean => {
    if (membership.endDate) {
      return new Date(membership.endDate) < new Date();
    }
    if (membership.visitsTotal) {
      return membership.visitsUsed >= membership.visitsTotal;
    }
    return false;
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ru}>
      <Box data-onboarding="client-memberships-page">
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold' }}>
            Выданные тарифы клиентам
          </Typography>
          <Button
            variant="contained"
            startIcon={<Add />}
            sx={{ textTransform: 'none' }}
            onClick={() => setOpenDialog(true)}
          >
            Выдать тариф клиенту
          </Button>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Card>
          <CardContent>
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Клиент</TableCell>
                    <TableCell>Тариф</TableCell>
                    <TableCell>Дата начала</TableCell>
                    <TableCell>Дата окончания</TableCell>
                    <TableCell>Посещения</TableCell>
                    <TableCell>Статус</TableCell>
                    <TableCell>Действия</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {memberships.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} align="center">
                        <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>
                          Абонементы не найдены
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    memberships.map((membership) => {
                      const expired = isExpired(membership);
                      return (
                        <TableRow key={membership.id}>
                          <TableCell>
                            {membership.client ? (
                              <ClientNameLink clientId={membership.clientId} client={membership.client} />
                            ) : (
                              '-'
                            )}
                          </TableCell>
                          <TableCell>{membership.membership?.name || '-'}</TableCell>
                          <TableCell>
                            {format(new Date(membership.startDate), 'dd.MM.yyyy', { locale: ru })}
                          </TableCell>
                          <TableCell>
                            {membership.endDate
                              ? format(new Date(membership.endDate), 'dd.MM.yyyy', { locale: ru })
                              : '-'}
                          </TableCell>
                          <TableCell>
                            {membership.visitsTotal
                              ? `${membership.visitsUsed} / ${membership.visitsTotal}`
                              : membership.visitsUsed}
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={expired || !membership.isActive ? 'Истек' : 'Активен'}
                              color={expired || !membership.isActive ? 'default' : 'success'}
                              size="small"
                            />
                          </TableCell>
                          <TableCell>
                            {membership.isActive && !expired && (
                              <IconButton
                                size="small"
                                color="primary"
                                title="Отметить посещение"
                                onClick={() => handleMarkVisit(membership.id)}
                              >
                                <CheckCircle />
                              </IconButton>
                            )}
                            <IconButton
                              size="small"
                              color="error"
                              title="Удалить"
                              onClick={() => handleDeleteMembership(membership.id)}
                            >
                              <Delete />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>

        {/* Диалог выдачи тарифа */}
        <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Выдать тариф клиенту</DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12}>
                <FormControl fullWidth required>
                  <InputLabel>Клиент</InputLabel>
                  <Select
                    value={formData.clientId}
                    onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
                    label="Клиент"
                  >
                    {clients.filter(c => c.isActive).map((client) => (
                      <MenuItem key={client.id} value={client.id}>
                        {[client.lastName, client.firstName, client.middleName].filter(Boolean).join(' ') || `${client.firstName} ${client.lastName}`}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <FormControl fullWidth required>
                  <InputLabel>Тариф</InputLabel>
                  <Select
                    value={formData.membershipId}
                    onChange={(e) => setFormData({ ...formData, membershipId: e.target.value })}
                    label="Тариф"
                  >
                    {membershipTypes.filter(m => m.isActive).map((membership) => (
                      <MenuItem key={membership.id} value={membership.id}>
                        {membership.name} - {membership.type === 'monthly' 
                          ? `${membership.duration} дней`
                          : `${membership.visits} посещений`} - {membership.price} ₽
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenDialog(false)}>Отмена</Button>
            <Button onClick={handleCreateMembership} variant="contained">
              Выдать тариф
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </LocalizationProvider>
  );
};

export default ClientMemberships;

