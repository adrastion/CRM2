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
import { Add, Edit, Delete, Visibility, Remove, FileDownload, FileUpload, LocalOffer } from '@mui/icons-material';
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
  const [importDialog, setImportDialog] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [branches, setBranches] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [filterBranchId, setFilterBranchId] = useState<string>('');
  const [filterCategoryId, setFilterCategoryId] = useState<string>('');
  const [statsDialog, setStatsDialog] = useState(false);
  const [selectedClientForStats, setSelectedClientForStats] = useState<Client | null>(null);
  const [clientStats, setClientStats] = useState<any>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [membershipDialog, setMembershipDialog] = useState(false);
  const [selectedClientForMembership, setSelectedClientForMembership] = useState<Client | null>(null);
  const [membershipTypes, setMembershipTypes] = useState<any[]>([]);
  const [selectedMembershipId, setSelectedMembershipId] = useState<string>('');
  const [formData, setFormData] = useState({
    // Данные ребенка
    firstName: '',
    lastName: '',
    middleName: '',
    email: '',
    phone: '',
    dateOfBirth: '',
    gender: '',
    address: '',
    birthCertificateNumber: '',
    medicalCertificateNumber: '',
    schoolOrKindergarten: '',
    categoryId: '',
    // Родители
    parents: [] as Array<{
      fullName: string;
      phone: string;
      email: string;
      workplace: string;
      workplaceContact: string;
    }>,
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

    const loadData = async () => {
      try {
        if (!isMounted || abortController.signal.aborted) return;
        setLoading(true);
        const [clientsRes, branchesRes, categoriesRes, membershipsRes] = await Promise.all([
          apiService.getClients(undefined, abortController.signal),
          apiService.getBranches(undefined, abortController.signal),
          apiService.getClientCategories().catch(() => ({ data: [] })),
          apiService.getMemberships().catch(() => ({ data: [] }))
        ]);
        if (!isMounted || abortController.signal.aborted) return;
        setClients(clientsRes.data);
        setBranches(branchesRes.data);
        setCategories(categoriesRes.data || []);
        setMembershipTypes(membershipsRes.data || []);
      } catch (err: any) {
        // Ignore cancelled requests
        if (err?.code === 'ERR_CANCELED' || err?.message === 'canceled' || abortController.signal.aborted) {
          return;
        }
        if (!isMounted) return;
        setError('Не удалось загрузить данные');
        console.error('Data loading error:', err);
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
        birthCertificateNumber: '',
        medicalCertificateNumber: '',
        schoolOrKindergarten: '',
        categoryId: '',
        parents: [],
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
      birthCertificateNumber: client.birthCertificateNumber || '',
      medicalCertificateNumber: client.medicalCertificateNumber || '',
      schoolOrKindergarten: client.schoolOrKindergarten || '',
      categoryId: (client as any).categoryId || '',
      parents: client.parents?.map(p => ({
        fullName: p.fullName || '',
        phone: p.phone || '',
        email: p.email || '',
        workplace: p.workplace || '',
        workplaceContact: p.workplaceContact || '',
      })) || [],
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
        birthCertificateNumber: '',
        medicalCertificateNumber: '',
        schoolOrKindergarten: '',
        categoryId: '',
        parents: [],
      });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка обновления клиента');
      console.error('Error updating client:', err);
    }
  };

  const handleExportClients = async () => {
    try {
      const blob = await apiService.exportClients();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `clients_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error('Error exporting clients:', error);
      setError('Не удалось экспортировать клиентов');
    }
  };

  const handleImportClients = async () => {
    if (!importFile) {
      alert('Пожалуйста, выберите файл');
      return;
    }

    setImporting(true);
    setError('');
    try {
      const result = await apiService.importClients(importFile);
      setImportResult(result.data);
      await fetchClients();
      if (result.data.errors && result.data.errors.length > 0) {
        // Показываем ошибки, но не закрываем диалог
      } else {
        setTimeout(() => {
          setImportDialog(false);
          setImportFile(null);
          setImportResult(null);
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
        }, 2000);
      }
    } catch (error: any) {
      console.error('Error importing clients:', error);
      setError(error?.response?.data?.error || 'Не удалось импортировать клиентов');
    } finally {
      setImporting(false);
    }
  };

  const handleGiveMembership = async () => {
    if (!selectedClientForMembership || !selectedMembershipId) {
      alert('Пожалуйста, выберите тариф');
      return;
    }

    try {
      await apiService.createClientMembership({
        clientId: selectedClientForMembership.id,
        membershipId: selectedMembershipId
      });
      await fetchClients();
      setMembershipDialog(false);
      setSelectedClientForMembership(null);
      setSelectedMembershipId('');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка выдачи тарифа');
      console.error('Error giving membership:', err);
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
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={<FileDownload />}
            sx={{ textTransform: 'none' }}
            onClick={handleExportClients}
          >
            Экспорт в Excel
          </Button>
          <Button
            variant="outlined"
            startIcon={<FileUpload />}
            sx={{ textTransform: 'none' }}
            onClick={() => {
              setImportDialog(true);
              setImportResult(null);
            }}
          >
            Импорт из Excel
          </Button>
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
      </Box>

      {/* Фильтры */}
      <Box sx={{ mb: 3, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <FormControl sx={{ minWidth: 200 }}>
          <InputLabel>Филиал</InputLabel>
          <Select
            value={filterBranchId}
            onChange={(e) => setFilterBranchId(e.target.value)}
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
        <FormControl sx={{ minWidth: 200 }}>
          <InputLabel>Категория</InputLabel>
          <Select
            value={filterCategoryId}
            onChange={(e) => setFilterCategoryId(e.target.value)}
            label="Категория"
          >
            <MenuItem value="">Все категории</MenuItem>
            {categories.map((category) => (
              <MenuItem key={category.id} value={category.id}>
                {category.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        {(filterBranchId || filterCategoryId) && (
          <Button
            variant="outlined"
            onClick={() => {
              setFilterBranchId('');
              setFilterCategoryId('');
            }}
          >
            Сбросить фильтры
          </Button>
        )}
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
                  <TableCell>Категория</TableCell>
                  <TableCell>Группы</TableCell>
                  <TableCell>Тарифы</TableCell>
                  <TableCell>Статус</TableCell>
                  <TableCell>Действия</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {clients
                  .filter((client) => {
                    // Фильтр по филиалу (через группы)
                    if (filterBranchId) {
                      const hasBranchGroup = client.groupMemberships?.some(
                        (gm) => gm.group?.branchId === filterBranchId
                      );
                      if (!hasBranchGroup) return false;
                    }
                    // Фильтр по категории
                    if (filterCategoryId) {
                      if ((client as any).categoryId !== filterCategoryId) return false;
                    }
                    return true;
                  })
                  .map((client) => (
                  <TableRow key={client.id}>
                    <TableCell>
                      {client.firstName} {client.lastName}
                    </TableCell>
                    <TableCell>{client.email || '-'}</TableCell>
                    <TableCell>{client.phone || '-'}</TableCell>
                    <TableCell>
                      {(client as any).category ? (
                        <Chip
                          label={(client as any).category.name}
                          size="small"
                          sx={{
                            backgroundColor: (client as any).category.color || 'primary.light',
                            color: 'white'
                          }}
                        />
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell>
                      {client.groupMemberships?.length || 0} групп
                    </TableCell>
                    <TableCell>
                      {(client as any).clientMemberships && (client as any).clientMemberships.length > 0 ? (
                        <Box>
                          {(client as any).clientMemberships.map((cm: any) => (
                            <Chip
                              key={cm.id}
                              label={
                                cm.membership?.type === 'monthly'
                                  ? `${cm.membership?.name} (до ${cm.endDate ? new Date(cm.endDate).toLocaleDateString('ru-RU') : '∞'})`
                                  : `${cm.membership?.name} (${cm.visitsUsed || 0}/${cm.visitsTotal || 0})`
                              }
                              size="small"
                              color="primary"
                              sx={{ mr: 0.5, mb: 0.5 }}
                            />
                          ))}
                        </Box>
                      ) : (
                        <Typography variant="body2" color="text.secondary">Нет тарифов</Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={client.isActive ? 'Активен' : 'Неактивен'}
                        color={client.isActive ? 'success' : 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <IconButton 
                        size="small" 
                        color="primary" 
                        title="Статистика посещаемости"
                        onClick={async () => {
                          setSelectedClientForStats(client);
                          setLoadingStats(true);
                          try {
                            const stats = await apiService.getClientStats(client.id);
                            setClientStats(stats);
                            setStatsDialog(true);
                          } catch (err: any) {
                            setError('Не удалось загрузить статистику');
                            console.error('Error loading stats:', err);
                          } finally {
                            setLoadingStats(false);
                          }
                        }}
                      >
                        <Visibility />
                      </IconButton>
                      <IconButton 
                        size="small" 
                        color="secondary" 
                        title="Выдать тариф"
                        onClick={() => {
                          setSelectedClientForMembership(client);
                          setMembershipDialog(true);
                        }}
                      >
                        <LocalOffer />
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
                label="Адрес проживания"
                value={formData.address}
                onChange={(e) => handleInputChange('address', e.target.value)}
                multiline
                rows={2}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label="Номер свидетельства о рождении"
                value={formData.birthCertificateNumber}
                onChange={(e) => handleInputChange('birthCertificateNumber', e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label="Номер справки"
                value={formData.medicalCertificateNumber}
                onChange={(e) => handleInputChange('medicalCertificateNumber', e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label="Место учебы/дет.сада"
                value={formData.schoolOrKindergarten}
                onChange={(e) => handleInputChange('schoolOrKindergarten', e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Категория клиента</InputLabel>
                <Select
                  value={formData.categoryId}
                  onChange={(e) => handleInputChange('categoryId', e.target.value)}
                  label="Категория клиента"
                >
                  <MenuItem value="">Без категории</MenuItem>
                  {categories.map((category) => (
                    <MenuItem key={category.id} value={category.id}>
                      {category.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            
            {/* Родители */}
            <Grid item xs={12}>
              <Box sx={{ border: '1px solid #e0e0e0', borderRadius: 1, p: 2, backgroundColor: 'background.default' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="subtitle1" fontWeight="medium">
                    Родители (необязательно)
                  </Typography>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<Add />}
                    onClick={() => {
                      setFormData({
                        ...formData,
                        parents: [
                          ...formData.parents,
                          {
                            fullName: '',
                            phone: '',
                            email: '',
                            workplace: '',
                            workplaceContact: '',
                          }
                        ]
                      });
                    }}
                  >
                    Добавить родителя
                  </Button>
                </Box>
                
                {formData.parents.map((parent, index) => (
                  <Paper key={index} sx={{ p: 2, mb: 2, border: '1px solid', borderColor: 'divider' }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                      <Typography variant="subtitle2" fontWeight="medium">
                        Родитель {index + 1}
                      </Typography>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => {
                          setFormData({
                            ...formData,
                            parents: formData.parents.filter((_, i) => i !== index)
                          });
                        }}
                      >
                        <Delete />
                      </IconButton>
                    </Box>
                    <Grid container spacing={2}>
                      <Grid item xs={12}>
                        <TextField
                          fullWidth
                          label="Полное ФИО родителя"
                          value={parent.fullName}
                          onChange={(e) => {
                            const newParents = [...formData.parents];
                            newParents[index].fullName = e.target.value;
                            setFormData({ ...formData, parents: newParents });
                          }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                          label="Телефон"
                          value={parent.phone}
                          onChange={(e) => {
                            const newParents = [...formData.parents];
                            newParents[index].phone = e.target.value;
                            setFormData({ ...formData, parents: newParents });
                          }}
                placeholder="+1234567890"
              />
            </Grid>
                      <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                          label="Email"
                          type="email"
                          value={parent.email}
                          onChange={(e) => {
                            const newParents = [...formData.parents];
                            newParents[index].email = e.target.value;
                            setFormData({ ...formData, parents: newParents });
                          }}
                        />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <TextField
                          fullWidth
                          label="Место работы"
                          value={parent.workplace}
                          onChange={(e) => {
                            const newParents = [...formData.parents];
                            newParents[index].workplace = e.target.value;
                            setFormData({ ...formData, parents: newParents });
                          }}
                        />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <TextField
                          fullWidth
                          label="Способ связи с местом работы"
                          value={parent.workplaceContact}
                          onChange={(e) => {
                            const newParents = [...formData.parents];
                            newParents[index].workplaceContact = e.target.value;
                            setFormData({ ...formData, parents: newParents });
                          }}
                          placeholder="Телефон, email и т.д."
                        />
                      </Grid>
                    </Grid>
                  </Paper>
                ))}
                
                {formData.parents.length === 0 && (
                  <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                    Родители не добавлены. Нажмите "Добавить родителя" для добавления.
                  </Typography>
                )}
              </Box>
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
                label="Адрес проживания"
                value={formData.address}
                onChange={(e) => handleInputChange('address', e.target.value)}
                multiline
                rows={2}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label="Номер свидетельства о рождении"
                value={formData.birthCertificateNumber}
                onChange={(e) => handleInputChange('birthCertificateNumber', e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label="Номер справки"
                value={formData.medicalCertificateNumber}
                onChange={(e) => handleInputChange('medicalCertificateNumber', e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label="Место учебы/дет.сада"
                value={formData.schoolOrKindergarten}
                onChange={(e) => handleInputChange('schoolOrKindergarten', e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Категория клиента</InputLabel>
                <Select
                  value={formData.categoryId}
                  onChange={(e) => handleInputChange('categoryId', e.target.value)}
                  label="Категория клиента"
                >
                  <MenuItem value="">Без категории</MenuItem>
                  {categories.map((category) => (
                    <MenuItem key={category.id} value={category.id}>
                      {category.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            
            {/* Родители */}
            <Grid item xs={12}>
              <Box sx={{ border: '1px solid #e0e0e0', borderRadius: 1, p: 2, backgroundColor: 'background.default' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="subtitle1" fontWeight="medium">
                    Родители (необязательно)
                  </Typography>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<Add />}
                    onClick={() => {
                      setFormData({
                        ...formData,
                        parents: [
                          ...formData.parents,
                          {
                            fullName: '',
                            phone: '',
                            email: '',
                            workplace: '',
                            workplaceContact: '',
                          }
                        ]
                      });
                    }}
                  >
                    Добавить родителя
                  </Button>
                </Box>
                
                {formData.parents.map((parent, index) => (
                  <Paper key={index} sx={{ p: 2, mb: 2, border: '1px solid', borderColor: 'divider' }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                      <Typography variant="subtitle2" fontWeight="medium">
                        Родитель {index + 1}
                      </Typography>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => {
                          setFormData({
                            ...formData,
                            parents: formData.parents.filter((_, i) => i !== index)
                          });
                        }}
                      >
                        <Delete />
                      </IconButton>
                    </Box>
                    <Grid container spacing={2}>
                      <Grid item xs={12}>
                        <TextField
                          fullWidth
                          label="Полное ФИО родителя"
                          value={parent.fullName}
                          onChange={(e) => {
                            const newParents = [...formData.parents];
                            newParents[index].fullName = e.target.value;
                            setFormData({ ...formData, parents: newParents });
                          }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                          label="Телефон"
                          value={parent.phone}
                          onChange={(e) => {
                            const newParents = [...formData.parents];
                            newParents[index].phone = e.target.value;
                            setFormData({ ...formData, parents: newParents });
                          }}
                placeholder="+1234567890"
              />
            </Grid>
                      <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                          label="Email"
                          type="email"
                          value={parent.email}
                          onChange={(e) => {
                            const newParents = [...formData.parents];
                            newParents[index].email = e.target.value;
                            setFormData({ ...formData, parents: newParents });
                          }}
                        />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <TextField
                          fullWidth
                          label="Место работы"
                          value={parent.workplace}
                          onChange={(e) => {
                            const newParents = [...formData.parents];
                            newParents[index].workplace = e.target.value;
                            setFormData({ ...formData, parents: newParents });
                          }}
                        />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <TextField
                          fullWidth
                          label="Способ связи с местом работы"
                          value={parent.workplaceContact}
                          onChange={(e) => {
                            const newParents = [...formData.parents];
                            newParents[index].workplaceContact = e.target.value;
                            setFormData({ ...formData, parents: newParents });
                          }}
                          placeholder="Телефон, email и т.д."
                        />
                      </Grid>
                    </Grid>
                  </Paper>
                ))}
                
                {formData.parents.length === 0 && (
                  <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                    Родители не добавлены. Нажмите "Добавить родителя" для добавления.
                  </Typography>
                )}
              </Box>
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

      {/* Import Dialog */}
      <Dialog open={importDialog} onClose={() => {
        if (!importing) {
          setImportDialog(false);
          setImportFile(null);
          setImportResult(null);
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
        }
      }} maxWidth="md" fullWidth>
        <DialogTitle>Импорт клиентов из Excel</DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
              {error}
            </Alert>
          )}
          {importResult && (
            <Alert 
              severity={importResult.errors && importResult.errors.length > 0 ? 'warning' : 'success'} 
              sx={{ mb: 2 }}
            >
              <Typography variant="body1" fontWeight="bold">
                Импортировано: {importResult.success} из {importResult.total}
              </Typography>
              {importResult.errors && importResult.errors.length > 0 && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="body2" fontWeight="bold" gutterBottom>
                    Ошибки ({importResult.errors.length}):
                  </Typography>
                  <Box sx={{ maxHeight: 200, overflow: 'auto' }}>
                    {importResult.errors.map((err: any, index: number) => (
                      <Typography key={index} variant="body2" sx={{ mb: 0.5 }}>
                        Строка {err.row}: {err.error}
                      </Typography>
                    ))}
                  </Box>
                </Box>
              )}
            </Alert>
          )}
          <Box sx={{ mt: 2 }}>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  setImportFile(file);
                  setImportResult(null);
                }
              }}
              style={{ display: 'none' }}
            />
            <Button
              variant="outlined"
              component="label"
              fullWidth
              sx={{ mb: 2 }}
              disabled={importing}
            >
              {importFile ? importFile.name : 'Выберите Excel файл'}
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setImportFile(file);
                    setImportResult(null);
                  }
                }}
                style={{ display: 'none' }}
              />
            </Button>
            <Typography variant="body2" color="text.secondary">
              Формат файла: Excel (.xlsx, .xls). Файл должен содержать колонки согласно шаблону экспорта.
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => {
              if (!importing) {
                setImportDialog(false);
                setImportFile(null);
                setImportResult(null);
                if (fileInputRef.current) {
                  fileInputRef.current.value = '';
                }
              }
            }}
            disabled={importing}
          >
            Отмена
          </Button>
          <Button 
            onClick={handleImportClients} 
            variant="contained"
            disabled={!importFile || importing}
          >
            {importing ? 'Импорт...' : 'Импортировать'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Диалог статистики посещаемости */}
      <Dialog open={statsDialog} onClose={() => setStatsDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          Статистика посещаемости: {selectedClientForStats?.firstName} {selectedClientForStats?.lastName}
        </DialogTitle>
        <DialogContent>
          {loadingStats ? (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
              <CircularProgress />
            </Box>
          ) : clientStats ? (
            <Grid container spacing={3} sx={{ mt: 1 }}>
              <Grid item xs={12} sm={6}>
                <Paper sx={{ p: 2, textAlign: 'center' }}>
                  <Typography variant="h4" color="primary" fontWeight="bold">
                    {clientStats.totalTrainings || 0}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Всего тренировок
                  </Typography>
                </Paper>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Paper sx={{ p: 2, textAlign: 'center' }}>
                  <Typography variant="h4" color="success.main" fontWeight="bold">
                    {clientStats.presentCount || 0}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Присутствовал
                  </Typography>
                </Paper>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Paper sx={{ p: 2, textAlign: 'center' }}>
                  <Typography variant="h4" color="info.main" fontWeight="bold">
                    {clientStats.attendanceRate?.toFixed(1) || 0}%
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Процент посещаемости
                  </Typography>
                </Paper>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Paper sx={{ p: 2, textAlign: 'center' }}>
                  <Typography variant="h4" color="warning.main" fontWeight="bold">
                    {clientStats.achievementsCount || 0}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Достижений
                  </Typography>
                </Paper>
              </Grid>
            </Grid>
          ) : (
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
              Нет данных для отображения
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setStatsDialog(false);
            setSelectedClientForStats(null);
            setClientStats(null);
          }}>Закрыть</Button>
        </DialogActions>
      </Dialog>

      {/* Диалог выдачи тарифа */}
      <Dialog open={membershipDialog} onClose={() => { setMembershipDialog(false); setSelectedMembershipId(''); }} maxWidth="sm" fullWidth>
        <DialogTitle>
          Выдать тариф клиенту: {selectedClientForMembership?.firstName} {selectedClientForMembership?.lastName}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <FormControl fullWidth required>
                <InputLabel>Тариф</InputLabel>
                <Select
                  value={selectedMembershipId}
                  onChange={(e) => setSelectedMembershipId(e.target.value)}
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
          <Button onClick={() => { setMembershipDialog(false); setSelectedMembershipId(''); }}>Отмена</Button>
          <Button onClick={handleGiveMembership} variant="contained" disabled={!selectedMembershipId}>
            Выдать тариф
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Clients;
