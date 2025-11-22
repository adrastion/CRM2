import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
} from '@mui/material';
import { Add, Edit, Delete, Visibility, Search, FilterList } from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { apiService } from '../services/api';
import { Payment, Client, Branch } from '../types';

interface PaymentFormData {
  amount: string;
  type: string;
  status: string;
  paymentMethod: string;
  notes: string;
  dueDate: Date | null;
  clientId: string;
  branchId: string;
}

const Payments: React.FC = () => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [editDialog, setEditDialog] = useState(false);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const debouncedSearchQuery = useDebounce(searchQuery, 500); // Debounce search with 500ms delay
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [formData, setFormData] = useState<PaymentFormData>({
    amount: '',
    type: 'membership',
    status: 'pending',
    paymentMethod: 'cash',
    notes: '',
    dueDate: null,
    clientId: '',
    branchId: '',
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

      const [paymentsRes, clientsRes, branchesRes] = await Promise.all([
        apiService.getPayments(params),
        apiService.getClients(),
        apiService.getBranches(),
      ]);
      
      setPayments(paymentsRes.data);
      setClients(clientsRes.data);
      setBranches(branchesRes.data);
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

        const [paymentsRes, clientsRes, branchesRes] = await Promise.all([
          apiService.getPayments(params, abortController.signal),
          apiService.getClients(undefined, abortController.signal),
          apiService.getBranches(undefined, abortController.signal),
        ]);
        
        if (!isMounted || abortController.signal.aborted) return;
        setPayments(paymentsRes.data);
        setClients(clientsRes.data);
        setBranches(branchesRes.data);
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
  }, []);

  const handleCreatePayment = async () => {
    try {
      if (!formData.clientId || !formData.branchId || !formData.amount) {
        alert('Пожалуйста, заполните все обязательные поля');
        return;
      }

      const paymentData = {
        ...formData,
        amount: parseFloat(formData.amount),
        dueDate: formData.dueDate ? formData.dueDate.toISOString() : null,
      };

      await apiService.createPayment(paymentData);
      await fetchData();
      setOpenDialog(false);
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
    });
    setEditDialog(true);
  };

  const handleUpdatePayment = async () => {
    if (!editingPayment) return;

    try {
      const paymentData = {
        ...formData,
        amount: parseFloat(formData.amount),
        dueDate: formData.dueDate ? formData.dueDate.toISOString() : null,
      };

      await apiService.updatePayment(editingPayment.id, paymentData);
      await fetchData();
      setEditDialog(false);
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
      const clientName = `${payment.client?.firstName || ''} ${payment.client?.lastName || ''}`.toLowerCase();
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
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold' }}>
            Платежи ({filteredPayments.length})
        </Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          sx={{ textTransform: 'none' }}
            onClick={() => setOpenDialog(true)}
        >
            Добавить платеж
        </Button>
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
                          {payment.client?.firstName} {payment.client?.lastName}
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
        <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="md" fullWidth>
          <DialogTitle>Добавить платеж</DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth required>
                  <InputLabel>Клиент</InputLabel>
                  <Select
                    value={formData.clientId}
                    onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
                    label="Клиент"
                  >
                    {clients.filter(c => c.isActive).map((client) => (
                      <MenuItem key={client.id} value={client.id}>
                        {client.firstName} {client.lastName}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth required>
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
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Тип платежа</InputLabel>
                  <Select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    label="Тип платежа"
                  >
                    <MenuItem value="membership">Абонемент</MenuItem>
                    <MenuItem value="single">Разовое</MenuItem>
                    <MenuItem value="penalty">Штраф</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
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
            <Button onClick={() => {
              setOpenDialog(false);
              resetForm();
            }}>Отмена</Button>
            <Button onClick={handleCreatePayment} variant="contained">
              Создать платеж
            </Button>
          </DialogActions>
        </Dialog>

        {/* Edit Payment Dialog */}
        <Dialog open={editDialog} onClose={() => setEditDialog(false)} maxWidth="md" fullWidth>
          <DialogTitle>Редактировать платеж</DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth required>
                  <InputLabel>Клиент</InputLabel>
                  <Select
                    value={formData.clientId}
                    onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
                    label="Клиент"
                  >
                    {clients.filter(c => c.isActive).map((client) => (
                      <MenuItem key={client.id} value={client.id}>
                        {client.firstName} {client.lastName}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth required>
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
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Тип платежа</InputLabel>
                  <Select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    label="Тип платежа"
                  >
                    <MenuItem value="membership">Абонемент</MenuItem>
                    <MenuItem value="single">Разовое</MenuItem>
                    <MenuItem value="penalty">Штраф</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
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
            <Button onClick={() => {
              setEditDialog(false);
              resetForm();
            }}>Отмена</Button>
            <Button onClick={handleUpdatePayment} variant="contained">
              Сохранить изменения
            </Button>
          </DialogActions>
        </Dialog>
    </Box>
    </LocalizationProvider>
  );
};

export default Payments;
