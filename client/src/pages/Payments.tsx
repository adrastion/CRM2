import React, { useState, useEffect, useCallback } from 'react';
import { useDebounce } from '../hooks/useDebounce';
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  CircularProgress,
  Alert,
  InputAdornment,
  Snackbar,
} from '@mui/material';
import { Add, Edit, Delete, Search, FilterList, Calculate, CalendarMonth } from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { apiService } from '../services/api';
import ClientNameLink from '../components/ClientNameLink';
import { Payment, Client, Branch } from '../types';
import { validatePaymentForm } from '../utils/validation';
import { useAuth } from '../contexts/AuthContext';

interface PaymentFormData {
  amount: string;
  type: string;
  status: string;
  paymentMethod: string;
  notes: string;
  dueDate: Date | null;
  clientId: string;
  branchId: string;
  membershipId: string;
}

const Payments: React.FC = () => {
  const { user } = useAuth();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [, setGroups] = useState<any[]>([]);
  const [memberships, setMemberships] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [editDialog, setEditDialog] = useState(false);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const debouncedSearchQuery = useDebounce(searchQuery, 500); // Debounce search with 500ms delay
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [recalculateDialog, setRecalculateDialog] = useState(false);
  const [recalculatingPayment, setRecalculatingPayment] = useState<Payment | null>(null);
  const [newAmount, setNewAmount] = useState<string>('');
  const [formData, setFormData] = useState<PaymentFormData>({
    amount: '',
    type: 'membership',
    status: 'pending',
    paymentMethod: 'cash',
    notes: '',
    dueDate: null,
    clientId: '',
    branchId: '',
    membershipId: '',
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params: any = {};
      if (selectedBranchId) {
        params.branchId = selectedBranchId;
      }
      if (searchQuery) {
        params.search = searchQuery;
      }

      const [paymentsRes, clientsRes, branchesRes, groupsRes, membershipsRes] = await Promise.all([
        apiService.getPayments(params),
        apiService.getClients({ limit: 100 }),
        apiService.getBranches(),
        apiService.getGroups({ limit: 1000, page: 1 }).catch(() => ({ data: [] })),
        apiService.getMemberships().catch(() => ({ data: [] })),
      ]);
      
      setPayments(paymentsRes.data);
      setClients(clientsRes.data);
      setBranches(branchesRes.data);
      setGroups(groupsRes.data || []);
      setMemberships(membershipsRes.data || []);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка загрузки данных');
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    const abortController = new AbortController();

    const loadData = async () => {
      try {
        if (!isMounted || abortController.signal.aborted) return;
        setLoading(true);
        setError(null);
        
        const params: any = {};
        if (selectedBranchId) {
          params.branchId = selectedBranchId;
        }
        if (debouncedSearchQuery) {
          params.search = debouncedSearchQuery;
        }

        const [paymentsRes, clientsRes, branchesRes, groupsRes, membershipsRes] = await Promise.all([
          apiService.getPayments(params, abortController.signal),
          apiService.getClients({ limit: 100 }, abortController.signal),
          apiService.getBranches(undefined, abortController.signal),
          apiService.getGroups({ limit: 1000, page: 1 }, abortController.signal).catch(() => ({ data: [] })),
          apiService.getMemberships(undefined, abortController.signal).catch(() => ({ data: [] })),
        ]);
        
        if (!isMounted || abortController.signal.aborted) return;
        setPayments(paymentsRes.data);
        setClients(clientsRes.data);
        setBranches(branchesRes.data);
        setGroups(groupsRes.data || []);
        setMemberships(membershipsRes.data || []);
      } catch (err: any) {
        // Ignore cancelled requests
        if (err?.code === 'ERR_CANCELED' || err?.message === 'canceled' || abortController.signal.aborted) {
          return;
        }
        if (!isMounted) return;
        setError(err.response?.data?.error || 'Ошибка загрузки данных');
        console.error('Error fetching data:', err);
      } finally {
        if (isMounted && !abortController.signal.aborted) {
          setLoading(false);
        }
      }
    };

    loadData();

    return () => {
      isMounted = false;
      abortController.abort();
    };
  }, [selectedBranchId, debouncedSearchQuery]); // Use debounced search query

  const handleSearch = useCallback(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetchData is stable
  }, []);

  const handleCreatePayment = async () => {
    try {
      const paymentData: any = {
        ...formData,
        amount: parseFloat(formData.amount),
        dueDate: formData.dueDate ? formData.dueDate.toISOString() : null,
      };

      // Добавляем membershipId только если тип платежа - абонемент
      if (formData.type === 'membership' && formData.membershipId) {
        paymentData.membershipId = formData.membershipId;
      } else {
        // Удаляем membershipId, если тип не абонемент
        delete paymentData.membershipId;
      }

      await apiService.createPayment(paymentData);
      await fetchData();
      setOpenDialog(false);
      setFormErrors({});
      resetForm();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка создания платежа');
      console.error('Error creating payment:', err);
    }
  };

  const handleEditPayment = (payment: Payment) => {
    setEditingPayment(payment);
    setFormData({
      amount: payment.amount.toString(),
      type: payment.type,
      status: payment.status,
      paymentMethod: payment.paymentMethod || 'cash',
      notes: payment.notes || '',
      dueDate: payment.dueDate ? new Date(payment.dueDate) : null,
      clientId: payment.clientId,
      branchId: payment.branchId || '',
      membershipId: payment.membershipId || '',
    });
    setEditDialog(true);
  };

  const handleUpdatePayment = async () => {
    if (!editingPayment) return;

    try {
      const paymentData: any = {
        ...formData,
        amount: parseFloat(formData.amount),
        dueDate: formData.dueDate ? formData.dueDate.toISOString() : null,
      };

      // Добавляем membershipId только если тип платежа - абонемент
      if (formData.type === 'membership' && formData.membershipId) {
        paymentData.membershipId = formData.membershipId;
      } else {
        // Удаляем membershipId, если тип не абонемент
        delete paymentData.membershipId;
      }

      await apiService.updatePayment(editingPayment.id, paymentData);
      await fetchData();
      setEditDialog(false);
      setFormErrors({});
      resetForm();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка обновления платежа');
      console.error('Error updating payment:', err);
    }
  };

  const handleDeletePayment = async (paymentId: string) => {
    if (window.confirm('Вы уверены, что хотите удалить этот платеж?')) {
      try {
        await apiService.deletePayment(paymentId);
        await fetchData();
      } catch (err: any) {
        setError(err.response?.data?.error || 'Ошибка удаления платежа');
        console.error('Error deleting payment:', err);
      }
    }
  };

  const handleRecalculatePayment = (payment: Payment) => {
    setRecalculatingPayment(payment);
    setNewAmount(payment.amount.toString());
    setRecalculateDialog(true);
  };

  const handleConfirmRecalculate = async () => {
    if (!recalculatingPayment) return;

    const amount = parseFloat(newAmount);
    if (isNaN(amount) || amount <= 0) {
      setSnackbarMessage('Введите корректную сумму');
      setSnackbarOpen(true);
      return;
    }

    try {
      await apiService.recalculateMonthlyPayment(recalculatingPayment.id, amount);
      setSnackbarMessage('Платеж успешно пересчитан');
      setSnackbarOpen(true);
      setRecalculateDialog(false);
      setRecalculatingPayment(null);
      setNewAmount('');
      await fetchData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка перерасчета платежа');
      console.error('Error recalculating payment:', err);
    }
  };

  const resetForm = () => {
    setFormData({
      amount: '',
      type: 'membership',
      status: 'pending',
      paymentMethod: 'cash',
      notes: '',
      dueDate: null,
      clientId: '',
      branchId: '',
      membershipId: '',
    });
    setEditingPayment(null);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'success';
      case 'pending':
        return 'warning';
      case 'cancelled':
        return 'default';
      case 'refunded':
        return 'error';
      default:
        return 'default';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'paid':
        return 'Оплачен';
      case 'pending':
        return 'Ожидает';
      case 'cancelled':
        return 'Отменен';
      case 'refunded':
        return 'Возвращен';
      default:
        return status;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'membership':
        return 'Абонемент';
      case 'single':
        return 'Разовое';
      case 'penalty':
        return 'Штраф';
      case 'monthly_payment':
        return 'Ежемесячный платеж';
      default:
        return type;
    }
  };

  const getPaymentMethodLabel = (method: string) => {
    switch (method) {
      case 'cash':
        return 'Наличные';
      case 'card':
        return 'Карта';
      case 'transfer':
        return 'Перевод';
      default:
        return method;
    }
  };

  const filteredPayments = payments.filter(payment => {
    if (selectedBranchId && payment.branchId !== selectedBranchId) {
      return false;
    }
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const clientName = payment.client ? [payment.client.lastName, payment.client.firstName, payment.client.middleName].filter(Boolean).join(' ').toLowerCase() : '';
      return clientName.includes(query) || payment.notes?.toLowerCase().includes(query);
    }
    return true;
  });

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ru}>
    <Box data-onboarding="payments-page">
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold' }}>
            Платежи ({filteredPayments.length})
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          {(user?.role === 'OWNER' || user?.role === 'ADMIN') && (
            <Button
              variant="outlined"
              startIcon={<CalendarMonth />}
              sx={{ textTransform: 'none' }}
              data-onboarding="create-monthly-payments-button"
              onClick={async () => {
                if (window.confirm('Создать ежемесячные платежи для всех групп с ежемесячной оплатой? Платежи будут созданы только для групп, у которых сегодня день оплаты (paymentDueDay).')) {
                  try {
                    setLoading(true);
                    const result = await apiService.createMonthlyPayments();
                    setSnackbarMessage(`Создано платежей: ${result.data.created}${result.data.errors > 0 ? `, ошибок: ${result.data.errors}` : ''}`);
                    setSnackbarOpen(true);
                    await fetchData();
                  } catch (err: any) {
                    setError(err.response?.data?.error || 'Ошибка создания ежемесячных платежей');
                    console.error('Error creating monthly payments:', err);
                  } finally {
                    setLoading(false);
                  }
                }
              }}
            >
              Создать ежемесячные платежи
            </Button>
          )}
          <Button
            variant="contained"
            startIcon={<Add />}
            sx={{ textTransform: 'none' }}
            onClick={() => {
              setOpenDialog(true);
              setFormErrors({});
              setError(null);
              resetForm();
            }}
          >
            Добавить платеж
          </Button>
        </Box>
      </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Filters */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} sm={4}>
                <FormControl fullWidth>
                  <InputLabel>Филиал</InputLabel>
                  <Select
                    value={selectedBranchId}
                    onChange={(e) => setSelectedBranchId(e.target.value)}
                    label="Филиал"
                  >
                    <MenuItem value="">Все филиалы</MenuItem>
                    {branches.map((branch) => (
                      <MenuItem key={branch.id} value={branch.id}>
                        {branch.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  placeholder="Поиск по клиенту или примечаниям"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleSearch();
                    }
                  }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Search />
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={2}>
                <Button
                  fullWidth
                  variant="outlined"
                  startIcon={<FilterList />}
                  onClick={handleSearch}
                >
                  Поиск
                </Button>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

      <Card>
        <CardContent>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                    <TableCell>Клиент</TableCell>
                    <TableCell>Сумма</TableCell>
                    <TableCell>Тип</TableCell>
                    <TableCell>Способ оплаты</TableCell>
                    <TableCell>Филиал</TableCell>
                    <TableCell>Дата</TableCell>
                    <TableCell>Статус</TableCell>
                    <TableCell>Действия</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                  {filteredPayments.length === 0 ? (
                <TableRow>
                      <TableCell colSpan={8} align="center">
                        <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>
                          Платежи не найдены
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredPayments.map((payment) => (
                      <TableRow key={payment.id}>
                  <TableCell>
                          {payment.client ? (
                            <ClientNameLink clientId={payment.clientId} client={payment.client} />
                          ) : (
                            '-'
                          )}
                  </TableCell>
                  <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                            {payment.amount.toLocaleString('ru-RU', {
                              style: 'currency',
                              currency: 'RUB',
                            })}
                          </Typography>
                  </TableCell>
                        <TableCell>{getTypeLabel(payment.type)}</TableCell>
                        <TableCell>{getPaymentMethodLabel(payment.paymentMethod || 'cash')}</TableCell>
                        <TableCell>{payment.branch?.name || '-'}</TableCell>
                  <TableCell>
                          {payment.paidAt
                            ? format(new Date(payment.paidAt), 'dd.MM.yyyy HH:mm', { locale: ru })
                            : payment.dueDate
                            ? format(new Date(payment.dueDate), 'dd.MM.yyyy', { locale: ru })
                            : '-'}
                  </TableCell>
                  <TableCell>
                          <Chip
                            label={getStatusLabel(payment.status)}
                            color={getStatusColor(payment.status) as any}
                            size="small"
                          />
                  </TableCell>
                  <TableCell>
                          <IconButton
                            size="small"
                            color="primary"
                            onClick={() => handleEditPayment(payment)}
                          >
                      <Edit />
                    </IconButton>
                          {payment.isMonthlyPayment && (user?.role === 'OWNER' || user?.role === 'ADMIN') && (
                            <IconButton
                              size="small"
                              color="secondary"
                              onClick={() => handleRecalculatePayment(payment)}
                              title="Перерасчет"
                              data-onboarding="recalculate-payment-button"
                            >
                              <Calculate />
                            </IconButton>
                          )}
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleDeletePayment(payment.id)}
                          >
                      <Delete />
                    </IconButton>
                  </TableCell>
                </TableRow>
                    ))
                  )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

        {/* Create Payment Dialog */}
        <Dialog 
          open={openDialog} 
          onClose={(event, reason) => {
            // Всегда проверяем ошибки перед закрытием
            const hasErrors = Object.keys(formErrors).length > 0;
            
            // Если есть ошибки, не закрываем диалог
            if (hasErrors || error) {
              setSnackbarMessage('Обнаружены ошибки в форме. Пожалуйста, исправьте их.');
              setSnackbarOpen(true);
              return;
            }
            
            // Разрешаем закрытие только если нет ошибок
            setOpenDialog(false);
            setFormErrors({});
            setError(null);
          }} 
          maxWidth="md" 
          fullWidth
          disableEscapeKeyDown={Object.keys(formErrors).length > 0 || !!error}
        >
          <DialogTitle>Добавить платеж</DialogTitle>
          <DialogContent>
            {error && (
              <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
                {error}
              </Alert>
            )}
            {Object.keys(formErrors).length > 0 && (
              <Alert severity="warning" sx={{ mb: 2 }}>
                Пожалуйста, исправьте {Object.keys(formErrors).length} {Object.keys(formErrors).length === 1 ? 'ошибку' : 'ошибок'} в форме
              </Alert>
            )}
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth required error={!!formErrors.clientId}>
                  <InputLabel>Клиент</InputLabel>
                  <Select
                    value={formData.clientId}
                    onChange={async (e) => {
                      const selectedClientId = e.target.value;
                      const selectedClient = clients.find(c => c.id === selectedClientId);
                      
                      // Автоматически определяем филиал клиента через активные группы
                      let branchId = '';
                      
                      if (selectedClient) {
                        // Ищем филиал через активные группы клиента (данные уже должны быть в загруженном списке)
                        const activeGroupMembership = (selectedClient as any).groupMemberships?.find(
                          (gm: any) => gm.isActive && gm.group?.branch
                        );
                        
                        if (activeGroupMembership?.group?.branch?.id) {
                          branchId = activeGroupMembership.group.branch.id;
                        } else {
                          // Если нет активной группы в загруженных данных, загружаем полные данные клиента
                          try {
                            const clientData = await apiService.getClient(selectedClientId);
                            const fullActiveGroup = (clientData as any).groupMemberships?.find(
                              (gm: any) => gm.isActive && gm.group?.branch
                            );
                            if (fullActiveGroup?.group?.branch?.id) {
                              branchId = fullActiveGroup.group.branch.id;
                            }
                          } catch (err) {
                            console.error('Error loading client details:', err);
                          }
                        }
                        
                        // Если не нашли через группы, ищем в последнем платеже клиента
                        if (!branchId) {
                          const lastPayment = payments
                            .filter(p => p.clientId === selectedClientId && p.branchId)
                            .sort((a, b) => {
                              const dateA = a.paidAt ? new Date(a.paidAt).getTime() : new Date(a.createdAt || '').getTime();
                              const dateB = b.paidAt ? new Date(b.paidAt).getTime() : new Date(b.createdAt || '').getTime();
                              return dateB - dateA;
                            })[0];
                          
                          if (lastPayment?.branchId) {
                            branchId = lastPayment.branchId;
                          }
                        }
                      }
                      
                      setFormData({ 
                        ...formData, 
                        clientId: selectedClientId,
                        branchId: branchId || formData.branchId // Сохраняем текущий, если не нашли
                      });
                    }}
                    label="Клиент"
                  >
                    {clients.filter(c => c.isActive).map((client) => (
                      <MenuItem key={client.id} value={client.id}>
                        {[client.lastName, client.firstName, client.middleName].filter(Boolean).join(' ') || `${client.firstName} ${client.lastName}`}
                      </MenuItem>
                    ))}
                  </Select>
                  {formErrors.clientId && (
                    <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.75 }}>
                      {formErrors.clientId}
                    </Typography>
                  )}
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth required error={!!formErrors.branchId}>
                  <InputLabel>Филиал</InputLabel>
                  <Select
                    value={formData.branchId}
                    onChange={(e) => setFormData({ ...formData, branchId: e.target.value })}
                    label="Филиал"
                  >
                    {branches.filter(b => b.isActive).map((branch) => (
                      <MenuItem key={branch.id} value={branch.id}>
                        {branch.name}
                      </MenuItem>
                    ))}
                  </Select>
                  {formErrors.branchId && (
                    <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.75 }}>
                      {formErrors.branchId}
                    </Typography>
                  )}
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  required
                  label="Сумма"
                  type="number"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  InputProps={{
                    endAdornment: <InputAdornment position="end">₽</InputAdornment>,
                  }}
                  error={!!formErrors.amount}
                  helperText={formErrors.amount}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth error={!!formErrors.type}>
                  <InputLabel>Тип платежа</InputLabel>
                  <Select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value, membershipId: e.target.value !== 'membership' ? '' : formData.membershipId })}
                    label="Тип платежа"
                  >
                    <MenuItem value="membership">Абонемент</MenuItem>
                    <MenuItem value="single">Разовое</MenuItem>
                    <MenuItem value="penalty">Штраф</MenuItem>
                  </Select>
                  {formErrors.type && (
                    <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.75 }}>
                      {formErrors.type}
                    </Typography>
                  )}
                </FormControl>
              </Grid>
              {formData.type === 'membership' && (
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth required error={!!formErrors.membershipId}>
                    <InputLabel>Абонемент</InputLabel>
                    <Select
                      value={formData.membershipId}
                      onChange={(e) => setFormData({ ...formData, membershipId: e.target.value })}
                      label="Абонемент"
                    >
                      {memberships.filter(m => m.isActive).map((membership) => (
                        <MenuItem key={membership.id} value={membership.id}>
                          {membership.name} - {Number(membership.price).toLocaleString('ru-RU', {
                            style: 'currency',
                            currency: 'RUB',
                          })}
                        </MenuItem>
                      ))}
                    </Select>
                    {formErrors.membershipId && (
                      <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.75 }}>
                        {formErrors.membershipId}
                      </Typography>
                    )}
                  </FormControl>
                </Grid>
              )}
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth error={!!formErrors.status}>
                  <InputLabel>Статус</InputLabel>
                  <Select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    label="Статус"
                  >
                    <MenuItem value="pending">Ожидает</MenuItem>
                    <MenuItem value="paid">Оплачен</MenuItem>
                    <MenuItem value="cancelled">Отменен</MenuItem>
                    <MenuItem value="refunded">Возвращен</MenuItem>
                  </Select>
                  {formErrors.status && (
                    <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.75 }}>
                      {formErrors.status}
                    </Typography>
                  )}
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Способ оплаты</InputLabel>
                  <Select
                    value={formData.paymentMethod}
                    onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                    label="Способ оплаты"
                  >
                    <MenuItem value="cash">Наличные</MenuItem>
                    <MenuItem value="card">Карта</MenuItem>
                    <MenuItem value="transfer">Перевод</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <DatePicker
                  label="Срок оплаты"
                  value={formData.dueDate}
                  onChange={(newValue) => setFormData({ ...formData, dueDate: newValue })}
                  slotProps={{
                    textField: {
                      fullWidth: true
                    }
                  }}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Примечания"
                  multiline
                  rows={3}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button 
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                
                // Отмена всегда закрывает форму без применения изменений
                setOpenDialog(false);
                setFormErrors({});
                setError(null);
                resetForm();
              }}
              type="button"
            >
              Отмена
            </Button>
            <Button 
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                e.nativeEvent.stopImmediatePropagation();
                
                // Выполняем валидацию синхронно
                const validationErrors = validatePaymentForm(formData);
                setFormErrors(validationErrors);
                
                // Если есть ошибки, показываем их и оставляем диалог открытым
                if (Object.keys(validationErrors).length > 0) {
                  setSnackbarMessage('Обнаружены ошибки в форме. Пожалуйста, исправьте их.');
                  setSnackbarOpen(true);
                  return; // Не создаем платеж, если есть ошибки
                }
                
                // Если нет ошибок, вызываем handleCreatePayment для сохранения
                handleCreatePayment();
              }} 
              variant="contained"
              type="button"
            >
              Создать платеж
            </Button>
          </DialogActions>
        </Dialog>

        {/* Edit Payment Dialog */}
        <Dialog 
          open={editDialog} 
          onClose={(event, reason) => {
            // Всегда проверяем ошибки перед закрытием
            const hasErrors = Object.keys(formErrors).length > 0;
            
            // Если есть ошибки, не закрываем диалог
            if (hasErrors || error) {
              setSnackbarMessage('Обнаружены ошибки в форме. Пожалуйста, исправьте их.');
              setSnackbarOpen(true);
              return;
            }
            
            // Разрешаем закрытие только если нет ошибок
            setEditDialog(false);
            setFormErrors({});
            setError(null);
          }} 
          maxWidth="md" 
          fullWidth
          disableEscapeKeyDown={Object.keys(formErrors).length > 0 || !!error}
        >
          <DialogTitle>Редактировать платеж</DialogTitle>
          <DialogContent>
            {error && (
              <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
                {error}
              </Alert>
            )}
            {Object.keys(formErrors).length > 0 && (
              <Alert severity="warning" sx={{ mb: 2 }}>
                Пожалуйста, исправьте {Object.keys(formErrors).length} {Object.keys(formErrors).length === 1 ? 'ошибку' : 'ошибок'} в форме
              </Alert>
            )}
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth required error={!!formErrors.clientId}>
                  <InputLabel>Клиент</InputLabel>
                  <Select
                    value={formData.clientId}
                    onChange={async (e) => {
                      const selectedClientId = e.target.value;
                      const selectedClient = clients.find(c => c.id === selectedClientId);
                      
                      // Автоматически определяем филиал клиента через активные группы
                      let branchId = '';
                      
                      if (selectedClient) {
                        // Ищем филиал через активные группы клиента (данные уже должны быть в загруженном списке)
                        const activeGroupMembership = (selectedClient as any).groupMemberships?.find(
                          (gm: any) => gm.isActive && gm.group?.branch
                        );
                        
                        if (activeGroupMembership?.group?.branch?.id) {
                          branchId = activeGroupMembership.group.branch.id;
                        } else {
                          // Если нет активной группы в загруженных данных, загружаем полные данные клиента
                          try {
                            const clientData = await apiService.getClient(selectedClientId);
                            const fullActiveGroup = (clientData as any).groupMemberships?.find(
                              (gm: any) => gm.isActive && gm.group?.branch
                            );
                            if (fullActiveGroup?.group?.branch?.id) {
                              branchId = fullActiveGroup.group.branch.id;
                            }
                          } catch (err) {
                            console.error('Error loading client details:', err);
                          }
                        }
                        
                        // Если не нашли через группы, ищем в последнем платеже клиента
                        if (!branchId) {
                          const lastPayment = payments
                            .filter(p => p.clientId === selectedClientId && p.branchId)
                            .sort((a, b) => {
                              const dateA = a.paidAt ? new Date(a.paidAt).getTime() : new Date(a.createdAt || '').getTime();
                              const dateB = b.paidAt ? new Date(b.paidAt).getTime() : new Date(b.createdAt || '').getTime();
                              return dateB - dateA;
                            })[0];
                          
                          if (lastPayment?.branchId) {
                            branchId = lastPayment.branchId;
                          }
                        }
                      }
                      
                      setFormData({ 
                        ...formData, 
                        clientId: selectedClientId,
                        branchId: branchId || formData.branchId // Сохраняем текущий, если не нашли
                      });
                    }}
                    label="Клиент"
                  >
                    {clients.filter(c => c.isActive).map((client) => (
                      <MenuItem key={client.id} value={client.id}>
                        {[client.lastName, client.firstName, client.middleName].filter(Boolean).join(' ') || `${client.firstName} ${client.lastName}`}
                      </MenuItem>
                    ))}
                  </Select>
                  {formErrors.clientId && (
                    <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.75 }}>
                      {formErrors.clientId}
                    </Typography>
                  )}
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth required error={!!formErrors.branchId}>
                  <InputLabel>Филиал</InputLabel>
                  <Select
                    value={formData.branchId}
                    onChange={(e) => setFormData({ ...formData, branchId: e.target.value })}
                    label="Филиал"
                  >
                    {branches.filter(b => b.isActive).map((branch) => (
                      <MenuItem key={branch.id} value={branch.id}>
                        {branch.name}
                      </MenuItem>
                    ))}
                  </Select>
                  {formErrors.branchId && (
                    <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.75 }}>
                      {formErrors.branchId}
                    </Typography>
                  )}
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  required
                  label="Сумма"
                  type="number"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  InputProps={{
                    endAdornment: <InputAdornment position="end">₽</InputAdornment>,
                  }}
                  error={!!formErrors.amount}
                  helperText={formErrors.amount}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth error={!!formErrors.type}>
                  <InputLabel>Тип платежа</InputLabel>
                  <Select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value, membershipId: e.target.value !== 'membership' ? '' : formData.membershipId })}
                    label="Тип платежа"
                  >
                    <MenuItem value="membership">Абонемент</MenuItem>
                    <MenuItem value="single">Разовое</MenuItem>
                    <MenuItem value="penalty">Штраф</MenuItem>
                  </Select>
                  {formErrors.type && (
                    <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.75 }}>
                      {formErrors.type}
                    </Typography>
                  )}
                </FormControl>
              </Grid>
              {formData.type === 'membership' && (
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth required error={!!formErrors.membershipId}>
                    <InputLabel>Абонемент</InputLabel>
                    <Select
                      value={formData.membershipId}
                      onChange={(e) => setFormData({ ...formData, membershipId: e.target.value })}
                      label="Абонемент"
                    >
                      {memberships.filter(m => m.isActive).map((membership) => (
                        <MenuItem key={membership.id} value={membership.id}>
                          {membership.name} - {Number(membership.price).toLocaleString('ru-RU', {
                            style: 'currency',
                            currency: 'RUB',
                          })}
                        </MenuItem>
                      ))}
                    </Select>
                    {formErrors.membershipId && (
                      <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.75 }}>
                        {formErrors.membershipId}
                      </Typography>
                    )}
                  </FormControl>
                </Grid>
              )}
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth error={!!formErrors.status}>
                  <InputLabel>Статус</InputLabel>
                  <Select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    label="Статус"
                  >
                    <MenuItem value="pending">Ожидает</MenuItem>
                    <MenuItem value="paid">Оплачен</MenuItem>
                    <MenuItem value="cancelled">Отменен</MenuItem>
                    <MenuItem value="refunded">Возвращен</MenuItem>
                  </Select>
                  {formErrors.status && (
                    <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.75 }}>
                      {formErrors.status}
                    </Typography>
                  )}
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Способ оплаты</InputLabel>
                  <Select
                    value={formData.paymentMethod}
                    onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                    label="Способ оплаты"
                  >
                    <MenuItem value="cash">Наличные</MenuItem>
                    <MenuItem value="card">Карта</MenuItem>
                    <MenuItem value="transfer">Перевод</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <DatePicker
                  label="Срок оплаты"
                  value={formData.dueDate}
                  onChange={(newValue) => setFormData({ ...formData, dueDate: newValue })}
                  slotProps={{
                    textField: {
                      fullWidth: true
                    }
                  }}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Примечания"
                  multiline
                  rows={3}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button 
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                
                // Отмена всегда закрывает форму без применения изменений
                setEditDialog(false);
                setEditingPayment(null);
                setFormErrors({});
                setError(null);
                resetForm();
              }}
              type="button"
            >
              Отмена
            </Button>
            <Button 
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                e.nativeEvent.stopImmediatePropagation();
                
                // Выполняем валидацию синхронно
                const validationErrors = validatePaymentForm(formData);
                setFormErrors(validationErrors);
                
                // Если есть ошибки, показываем их и оставляем диалог открытым
                if (Object.keys(validationErrors).length > 0) {
                  setSnackbarMessage('Обнаружены ошибки в форме. Пожалуйста, исправьте их.');
                  setSnackbarOpen(true);
                  return; // Не обновляем платеж, если есть ошибки
                }
                
                // Если нет ошибок, вызываем handleUpdatePayment для сохранения
                handleUpdatePayment();
              }} 
              variant="contained"
              type="button"
            >
              Сохранить изменения
            </Button>
          </DialogActions>
        </Dialog>

      {/* Диалог перерасчета платежа */}
      <Dialog
        open={recalculateDialog}
        onClose={() => {
          setRecalculateDialog(false);
          setRecalculatingPayment(null);
          setNewAmount('');
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Перерасчет ежемесячного платежа</DialogTitle>
        <DialogContent>
          {recalculatingPayment && (
            <>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Клиент:{' '}
                {recalculatingPayment.client ? (
                  <ClientNameLink
                    clientId={recalculatingPayment.clientId}
                    client={recalculatingPayment.client}
                    variant="inherit"
                    sx={{ color: 'text.secondary', fontWeight: 400, display: 'inline' }}
                  />
                ) : (
                  '-'
                )}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Текущая сумма: {recalculatingPayment.amount.toLocaleString('ru-RU', {
                  style: 'currency',
                  currency: 'RUB',
                })}
              </Typography>
              {recalculatingPayment.originalAmount && Number(recalculatingPayment.originalAmount) !== recalculatingPayment.amount && (
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Оригинальная сумма: {Number(recalculatingPayment.originalAmount).toLocaleString('ru-RU', {
                    style: 'currency',
                    currency: 'RUB',
                  })}
                </Typography>
              )}
              <TextField
                fullWidth
                label="Новая сумма (руб.)"
                type="number"
                value={newAmount}
                onChange={(e) => setNewAmount(e.target.value)}
                inputProps={{ min: 0, step: 0.01 }}
                sx={{ mt: 2 }}
              />
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setRecalculateDialog(false);
            setRecalculatingPayment(null);
            setNewAmount('');
          }}>
            Отмена
          </Button>
          <Button onClick={handleConfirmRecalculate} variant="contained" color="primary">
            Пересчитать
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar для отображения ошибок валидации */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={() => setSnackbarOpen(false)}
        message={snackbarMessage}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Box>
    </LocalizationProvider>
  );
};

export default Payments;
