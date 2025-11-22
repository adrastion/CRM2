import React, { useState, useEffect, useRef } from 'react';
import { validateClientForm } from '../utils/validation';
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
  TextField,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import { Add, Edit, Delete, Visibility } from '@mui/icons-material';
import { apiService } from '../services/api';
import { Client } from '../types';

const Clients: React.FC = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [openDialog, setOpenDialog] = useState(false);
  const [editDialog, setEditDialog] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [hasValidationErrors, setHasValidationErrors] = useState(false);
  const hasErrorsRef = useRef(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    middleName: '',
    email: '',
    phone: '',
    dateOfBirth: '',
    gender: '',
    address: '',
    emergencyContact: '',
    emergencyPhone: '',
    medicalNotes: '',
  });

  const fetchClients = async () => {
    try {
      setLoading(true);
      const response = await apiService.getClients();
      setClients(response.data);
    } catch (err: any) {
      setError('Не удалось загрузить клиентов');
      console.error('Clients error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    const abortController = new AbortController();

    const loadClients = async () => {
      try {
        if (!isMounted || abortController.signal.aborted) return;
        setLoading(true);
        const response = await apiService.getClients(undefined, abortController.signal);
        if (!isMounted || abortController.signal.aborted) return;
        setClients(response.data);
      } catch (err: any) {
        // Ignore cancelled requests
        if (err?.code === 'ERR_CANCELED' || err?.message === 'canceled' || abortController.signal.aborted) {
          return;
        }
        if (!isMounted) return;
        setError('Не удалось загрузить клиентов');
        console.error('Clients error:', err);
      } finally {
        if (isMounted && !abortController.signal.aborted) {
          setLoading(false);
        }
      }
    };

    loadClients();

    return () => {
      isMounted = false;
      abortController.abort();
    };
  }, []);

  const handleCreateClient = async () => {
    // Validate form
    const errors = validateClientForm(formData);
    const hasErrors = Object.keys(errors).length > 0;
    
    // Устанавливаем флаги синхронно
    hasErrorsRef.current = hasErrors;
    setFormErrors(errors);
    setHasValidationErrors(hasErrors);
    
    if (hasErrors) {
      setError('Пожалуйста, исправьте ошибки в форме');
      // Убеждаемся, что диалог остается открытым
      return;
    }
    
    // Если ошибок нет, сбрасываем флаг
    hasErrorsRef.current = false;

    try {
      await apiService.createClient(formData);
      await fetchClients();
      // Сбрасываем все флаги и закрываем диалог только после успешного создания
      hasErrorsRef.current = false;
      setFormErrors({});
      setError('');
      setHasValidationErrors(false);
      setOpenDialog(false);
      setFormData({
        firstName: '',
        lastName: '',
        middleName: '',
        email: '',
        phone: '',
        dateOfBirth: '',
        gender: '',
        address: '',
        emergencyContact: '',
        emergencyPhone: '',
        medicalNotes: '',
      });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка создания клиента');
      console.error('Error creating client:', err);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    // Clear error for this field when user starts typing
    if (formErrors[field]) {
      setFormErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        // Если все ошибки исправлены, сбрасываем флаги
        if (Object.keys(newErrors).length === 0) {
          setHasValidationErrors(false);
          hasErrorsRef.current = false;
        }
        return newErrors;
      });
    }
    // Clear general error when user starts typing
    if (error) {
      setError('');
    }
  };

  const handleEditClient = (client: Client) => {
    setEditingClient(client);
    setFormData({
      firstName: client.firstName || '',
      lastName: client.lastName || '',
      middleName: client.middleName || '',
      email: client.email || '',
      phone: client.phone || '',
      dateOfBirth: client.dateOfBirth ? client.dateOfBirth.split('T')[0] : '',
      gender: client.gender || '',
      address: client.address || '',
      emergencyContact: client.emergencyContact || '',
      emergencyPhone: client.emergencyPhone || '',
      medicalNotes: client.medicalNotes || '',
    });
    setEditDialog(true);
  };

  const handleUpdateClient = async () => {
    if (!editingClient) return;
    
    // Validate form
    const errors = validateClientForm(formData);
    setFormErrors(errors);
    
    if (Object.keys(errors).length > 0) {
      setError('Пожалуйста, исправьте ошибки в форме');
      return;
    }
    
    try {
      await apiService.updateClient(editingClient.id, formData);
      await fetchClients();
      setEditDialog(false);
      setEditingClient(null);
      setFormErrors({});
      setError('');
      setFormData({
        firstName: '',
        lastName: '',
        middleName: '',
        email: '',
        phone: '',
        dateOfBirth: '',
        gender: '',
        address: '',
        emergencyContact: '',
        emergencyPhone: '',
        medicalNotes: '',
      });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка обновления клиента');
      console.error('Error updating client:', err);
    }
  };

  const handleDeleteClient = async (clientId: string) => {
    console.log('Attempting to delete client:', clientId);
    if (window.confirm('Вы уверены, что хотите удалить этого клиента?')) {
      try {
        console.log('Deleting client...');
        await apiService.deleteClient(clientId);
        console.log('Client deleted successfully, refreshing list...');
        await fetchClients();
        console.log('Client list refreshed');
      } catch (err: any) {
        console.error('Error deleting client:', err);
        setError(err.response?.data?.error || 'Ошибка удаления клиента');
      }
    } else {
      console.log('Delete cancelled by user');
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        {error}
      </Alert>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold' }}>
          Клиенты
        </Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          sx={{ textTransform: 'none' }}
          onClick={() => {
            setOpenDialog(true);
            setFormErrors({});
            setError('');
            setHasValidationErrors(false);
            hasErrorsRef.current = false;
          }}
        >
          Добавить клиента
        </Button>
      </Box>

      <Card>
        <CardContent>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Имя</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Телефон</TableCell>
                  <TableCell>Группы</TableCell>
                  <TableCell>Статус</TableCell>
                  <TableCell>Действия</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {clients.map((client) => (
                  <TableRow key={client.id}>
                    <TableCell>
                      {client.firstName} {client.lastName}
                    </TableCell>
                    <TableCell>{client.email || '-'}</TableCell>
                    <TableCell>{client.phone || '-'}</TableCell>
                    <TableCell>
                      {client.groupMemberships?.length || 0} групп
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={client.isActive ? 'Активен' : 'Неактивен'}
                        color={client.isActive ? 'success' : 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <IconButton size="small" color="primary" title="Просмотр">
                        <Visibility />
                      </IconButton>
                      <IconButton 
                        size="small" 
                        color="primary" 
                        title="Редактировать"
                        onClick={() => handleEditClient(client)}
                      >
                        <Edit />
                      </IconButton>
                      <IconButton 
                        size="small" 
                        color="error" 
                        title="Удалить"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          console.log('Delete button clicked for client:', client.id);
                          handleDeleteClient(client.id);
                        }}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                      >
                        <Delete />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Диалог добавления клиента */}
      <Dialog 
        open={(() => {
          // Если openDialog true, диалог открыт
          if (openDialog) return true;
          // Если есть ошибки, принудительно оставляем открытым
          const hasErrors = Boolean(
            hasErrorsRef.current || 
            hasValidationErrors || 
            Object.keys(formErrors).length > 0 || 
            (error && error.length > 0)
          );
          return hasErrors;
        })()}
        onClose={(event: React.SyntheticEvent, reason?: string) => {
          // Проверяем наличие ошибок
          const hasErrors = hasErrorsRef.current || hasValidationErrors || Object.keys(formErrors).length > 0 || error;
          if (hasErrors) {
            // Если есть ошибки, НЕ закрываем диалог - просто игнорируем попытку закрытия
            return;
          }
          // Разрешаем закрытие только если нет ошибок
          hasErrorsRef.current = false;
          setOpenDialog(false);
          setFormErrors({});
          setError('');
          setHasValidationErrors(false);
        }}
        maxWidth="md" 
        fullWidth
        disableEscapeKeyDown={hasErrorsRef.current || hasValidationErrors || Object.keys(formErrors).length > 0}
      >
        <DialogTitle>Добавить нового клиента</DialogTitle>
        <DialogContent>
          {Object.keys(formErrors).length > 0 && (
            <Alert severity="error" sx={{ mb: 2 }}>
              <strong>Обнаружены ошибки в форме:</strong>
              <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px' }}>
                {Object.entries(formErrors).map(([field, message]) => (
                  <li key={field} style={{ marginBottom: '4px' }}>{message}</li>
                ))}
              </ul>
            </Alert>
          )}
          {error && Object.keys(formErrors).length === 0 && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
              {error}
            </Alert>
          )}
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label="Имя"
                value={formData.firstName}
                onChange={(e) => handleInputChange('firstName', e.target.value)}
                required
                error={!!formErrors.firstName}
                helperText={formErrors.firstName}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label="Фамилия"
                value={formData.lastName}
                onChange={(e) => handleInputChange('lastName', e.target.value)}
                required
                error={!!formErrors.lastName}
                helperText={formErrors.lastName}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label="Отчество"
                value={formData.middleName}
                onChange={(e) => handleInputChange('middleName', e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Email"
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                error={!!formErrors.email}
                helperText={formErrors.email}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Телефон"
                value={formData.phone}
                onChange={(e) => handleInputChange('phone', e.target.value)}
                placeholder="+1234567890"
                error={!!formErrors.phone}
                helperText={formErrors.phone}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Дата рождения"
                type="date"
                value={formData.dateOfBirth}
                onChange={(e) => handleInputChange('dateOfBirth', e.target.value)}
                InputLabelProps={{ shrink: true }}
                error={!!formErrors.dateOfBirth}
                helperText={formErrors.dateOfBirth}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Пол</InputLabel>
                <Select
                  value={formData.gender}
                  onChange={(e) => handleInputChange('gender', e.target.value)}
                >
                  <MenuItem value="male">Мужской</MenuItem>
                  <MenuItem value="female">Женский</MenuItem>
                  <MenuItem value="other">Другой</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Адрес"
                value={formData.address}
                onChange={(e) => handleInputChange('address', e.target.value)}
                multiline
                rows={2}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Экстренный контакт"
                value={formData.emergencyContact}
                onChange={(e) => handleInputChange('emergencyContact', e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Телефон экстренного контакта"
                value={formData.emergencyPhone}
                onChange={(e) => handleInputChange('emergencyPhone', e.target.value)}
                placeholder="+1234567890"
                error={!!formErrors.emergencyPhone}
                helperText={formErrors.emergencyPhone}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Медицинские заметки"
                value={formData.medicalNotes}
                onChange={(e) => handleInputChange('medicalNotes', e.target.value)}
                multiline
                rows={3}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            // Разрешаем закрытие только если нет ошибок
            if (!hasErrorsRef.current && !hasValidationErrors && Object.keys(formErrors).length === 0 && !error) {
              hasErrorsRef.current = false;
              setOpenDialog(false);
              setFormErrors({});
              setError('');
              setHasValidationErrors(false);
            }
          }}>Отмена</Button>
          <Button 
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              // Валидируем форму перед отправкой
              const errors = validateClientForm(formData);
              const hasErrors = Object.keys(errors).length > 0;
              
              // Устанавливаем флаги синхронно
              hasErrorsRef.current = hasErrors;
              
              if (hasErrors) {
                setFormErrors(errors);
                setHasValidationErrors(true);
                setError('Пожалуйста, исправьте ошибки в форме');
                return;
              }
              
              // Если ошибок нет, сбрасываем флаги и вызываем создание
              hasErrorsRef.current = false;
              setHasValidationErrors(false);
              handleCreateClient();
            }} 
            variant="contained"
            type="button"
          >
            Создать клиента
          </Button>
        </DialogActions>
      </Dialog>

      {/* Диалог редактирования клиента */}
      <Dialog 
        open={editDialog} 
        onClose={(event, reason) => {
          // Предотвращаем закрытие при наличии ошибок
          if (Object.keys(formErrors).length > 0 || error) {
            return;
          }
          setEditDialog(false);
          setFormErrors({});
          setError('');
        }}
        maxWidth="md" 
        fullWidth
      >
        <DialogTitle>Редактировать клиента</DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
              {error}
            </Alert>
          )}
          {Object.keys(formErrors).length > 0 && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              Пожалуйста, исправьте {Object.keys(formErrors).length} {Object.keys(formErrors).length === 1 ? 'ошибку' : 'ошибок'} в форме
            </Alert>
          )}
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label="Имя"
                value={formData.firstName}
                onChange={(e) => handleInputChange('firstName', e.target.value)}
                required
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label="Фамилия"
                value={formData.lastName}
                onChange={(e) => handleInputChange('lastName', e.target.value)}
                required
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label="Отчество"
                value={formData.middleName}
                onChange={(e) => handleInputChange('middleName', e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Email"
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Телефон"
                value={formData.phone}
                onChange={(e) => handleInputChange('phone', e.target.value)}
                placeholder="+1234567890"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Дата рождения"
                type="date"
                value={formData.dateOfBirth}
                onChange={(e) => handleInputChange('dateOfBirth', e.target.value)}
                InputLabelProps={{ shrink: true }}
                error={!!formErrors.dateOfBirth}
                helperText={formErrors.dateOfBirth}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Пол</InputLabel>
                <Select
                  value={formData.gender}
                  onChange={(e) => handleInputChange('gender', e.target.value)}
                >
                  <MenuItem value="male">Мужской</MenuItem>
                  <MenuItem value="female">Женский</MenuItem>
                  <MenuItem value="other">Другой</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Адрес"
                value={formData.address}
                onChange={(e) => handleInputChange('address', e.target.value)}
                multiline
                rows={2}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Экстренный контакт"
                value={formData.emergencyContact}
                onChange={(e) => handleInputChange('emergencyContact', e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Телефон экстренного контакта"
                value={formData.emergencyPhone}
                onChange={(e) => handleInputChange('emergencyPhone', e.target.value)}
                placeholder="+1234567890"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Медицинские заметки"
                value={formData.medicalNotes}
                onChange={(e) => handleInputChange('medicalNotes', e.target.value)}
                multiline
                rows={3}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            // Разрешаем закрытие только если нет ошибок
            if (Object.keys(formErrors).length === 0 && !error) {
              setEditDialog(false);
              setEditingClient(null);
              setFormErrors({});
              setError('');
            }
          }}>Отмена</Button>
          <Button onClick={handleUpdateClient} variant="contained">
            Сохранить изменения
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Clients;
