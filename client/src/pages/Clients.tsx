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
  TableSortLabel,
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
} from '@mui/material';
import { Add, Edit, Delete, Visibility, Remove, FileDownload, FileUpload, LocalOffer, Download, Info, Phone, Check, Close, Assignment } from '@mui/icons-material';
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
  const [isDragOver, setIsDragOver] = useState(false);
  const [branches, setBranches] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [filterBranchId, setFilterBranchId] = useState<string>('');
  const [filterCategoryId, setFilterCategoryId] = useState<string>('');
  const [filterGroupId, setFilterGroupId] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [editingPhoneClientId, setEditingPhoneClientId] = useState<string | null>(null);
  const [editingPhoneValue, setEditingPhoneValue] = useState<string>('');
  const [groupsDialog, setGroupsDialog] = useState(false);
  const [selectedClientForGroups, setSelectedClientForGroups] = useState<Client | null>(null);
  const [statsDialog, setStatsDialog] = useState(false);
  const [selectedClientForStats, setSelectedClientForStats] = useState<Client | null>(null);
  const [standardsDialog, setStandardsDialog] = useState(false);
  const [selectedClientForStandards, setSelectedClientForStandards] = useState<Client | null>(null);
  const [clientStandards, setClientStandards] = useState<any[]>([]);
  const [standards, setStandards] = useState<any[]>([]);
  const [loadingClientStandards, setLoadingClientStandards] = useState(false);
  const [addStandardDialog, setAddStandardDialog] = useState(false);
  const [selectedStandardId, setSelectedStandardId] = useState<string>('');
  const [standardResult, setStandardResult] = useState<string>('');
  const [standardResultText, setStandardResultText] = useState<string>('');
  const [standardStatus, setStandardStatus] = useState<string>('completed');
  const [standardNotes, setStandardNotes] = useState<string>('');
  const [standardCompletedAt, setStandardCompletedAt] = useState<string>(new Date().toISOString().split('T')[0]);
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
    groupIds: [] as string[],
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
      const response = await apiService.getClients({ limit: 100 });
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
        const [clientsRes, branchesRes, categoriesRes, membershipsRes, groupsRes] = await Promise.all([
          apiService.getClients({ limit: 100 }, abortController.signal),
          apiService.getBranches(undefined, abortController.signal),
          apiService.getClientCategories().catch(() => ({ data: [] })),
          apiService.getMemberships().catch(() => ({ data: [] })),
          apiService.getGroups(undefined, abortController.signal).catch(() => ({ data: [] }))
        ]);
        if (!isMounted || abortController.signal.aborted) return;
        setClients(clientsRes.data);
        setBranches(branchesRes.data);
        setCategories(categoriesRes.data || []);
        setMembershipTypes(membershipsRes.data || []);
        setGroups(groupsRes.data || []);
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
      const { groupIds, ...clientData } = formData;
      const createdClient = await apiService.createClient(clientData);
      
      // Добавляем клиента в выбранные группы
      if (groupIds && groupIds.length > 0 && createdClient?.id) {
        for (const groupId of groupIds) {
          try {
            await apiService.addClientToGroup(groupId, createdClient.id);
          } catch (err: any) {
            console.error(`Error adding client to group ${groupId}:`, err);
            // Продолжаем добавлять в другие группы даже если одна не удалась
          }
        }
      }
      
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
        groupIds: [],
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
      groupIds: client.groupMemberships
        ?.filter((gm: any) => gm.isActive)
        .map((gm: any) => gm.group?.id)
        .filter(Boolean) || [],
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
      const { groupIds, ...clientData } = formData;
      await apiService.updateClient(editingClient.id, clientData);
      
      // Обновляем группы клиента
      const currentGroupIds = editingClient.groupMemberships
        ?.filter((gm: any) => gm.isActive)
        .map((gm: any) => gm.group?.id)
        .filter(Boolean) || [];
      const newGroupIds = groupIds || [];
      
      // Удаляем из групп, которых больше нет в списке
      for (const currentGroupId of currentGroupIds) {
        if (!newGroupIds.includes(currentGroupId)) {
          try {
            await apiService.removeClientFromGroup(currentGroupId, editingClient.id);
          } catch (err: any) {
            console.error(`Error removing client from group ${currentGroupId}:`, err);
          }
        }
      }
      
      // Добавляем в новые группы
      for (const newGroupId of newGroupIds) {
        if (!currentGroupIds.includes(newGroupId)) {
          try {
            await apiService.addClientToGroup(newGroupId, editingClient.id);
          } catch (err: any) {
            console.error(`Error adding client to group ${newGroupId}:`, err);
          }
        }
      }
      
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
        groupIds: [],
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

  const handleDownloadTemplate = async () => {
    try {
      const blob = await apiService.downloadClientTemplate();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'template_import_clients.xlsx';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error('Error downloading template:', error);
      setError('Не удалось скачать шаблон');
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        setImportFile(file);
        setImportResult(null);
      } else {
        setError('Поддерживаются только файлы Excel (.xlsx, .xls)');
      }
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

  const handleOpenStandardsDialog = async (client: Client) => {
    setSelectedClientForStandards(client);
    setStandardsDialog(true);
    setLoadingClientStandards(true);
    try {
      // Загружаем нормативы клиента
      const standardsRes = await apiService.getClientStandards(client.id);
      setClientStandards(standardsRes.data);
      
      // Загружаем шаблоны нормативов
      const templatesRes = await apiService.getStandards({ isActive: 'true' });
      setStandards(templatesRes.data);
    } catch (err: any) {
      setError('Не удалось загрузить нормативы');
      console.error('Error loading standards:', err);
    } finally {
      setLoadingClientStandards(false);
    }
  };

  const handleAddClientStandard = async () => {
    if (!selectedClientForStandards || !selectedStandardId) {
      setError('Выберите норматив');
      return;
    }

    try {
      await apiService.addClientStandard(selectedClientForStandards.id, {
        standardId: selectedStandardId,
        completedAt: standardCompletedAt,
        result: standardResult || undefined,
        resultText: standardResultText || undefined,
        status: standardStatus,
        notes: standardNotes || undefined,
      });
      
      // Обновляем список нормативов
      const standardsRes = await apiService.getClientStandards(selectedClientForStandards.id);
      setClientStandards(standardsRes.data);
      
      // Очищаем форму
      setSelectedStandardId('');
      setStandardResult('');
      setStandardResultText('');
      setStandardStatus('completed');
      setStandardNotes('');
      setStandardCompletedAt(new Date().toISOString().split('T')[0]);
      setAddStandardDialog(false);
      setError('');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Не удалось добавить норматив');
    }
  };

  const handleDeleteClientStandard = async (clientStandardId: string) => {
    if (!selectedClientForStandards) return;
    
    if (window.confirm('Вы уверены, что хотите удалить эту запись о нормативе?')) {
      try {
        await apiService.deleteClientStandard(selectedClientForStandards.id, clientStandardId);
        
        // Обновляем список нормативов
        const standardsRes = await apiService.getClientStandards(selectedClientForStandards.id);
        setClientStandards(standardsRes.data);
        setError('');
      } catch (err: any) {
        setError(err?.response?.data?.error || 'Не удалось удалить норматив');
      }
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
        <FormControl sx={{ minWidth: 200 }}>
          <InputLabel>Группа</InputLabel>
          <Select
            value={filterGroupId}
            onChange={(e) => setFilterGroupId(e.target.value)}
            label="Группа"
          >
            <MenuItem value="">Все группы</MenuItem>
            {groups.filter(g => g.isActive).map((group) => (
              <MenuItem key={group.id} value={group.id}>
                {group.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        {(filterBranchId || filterCategoryId || filterGroupId) && (
          <Button
            variant="outlined"
            onClick={() => {
              setFilterBranchId('');
              setFilterCategoryId('');
              setFilterGroupId('');
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
                  <TableCell>
                    <TableSortLabel
                      active={sortBy === 'firstName'}
                      direction={sortBy === 'firstName' ? sortOrder : 'asc'}
                      onClick={() => {
                        if (sortBy === 'firstName') {
                          setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                        } else {
                          setSortBy('firstName');
                          setSortOrder('asc');
                        }
                      }}
                    >
                      Имя
                    </TableSortLabel>
                  </TableCell>
                  <TableCell>
                    <TableSortLabel
                      active={sortBy === 'email'}
                      direction={sortBy === 'email' ? sortOrder : 'asc'}
                      onClick={() => {
                        if (sortBy === 'email') {
                          setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                        } else {
                          setSortBy('email');
                          setSortOrder('asc');
                        }
                      }}
                    >
                      Email
                    </TableSortLabel>
                  </TableCell>
                  <TableCell>
                    <TableSortLabel
                      active={sortBy === 'phone'}
                      direction={sortBy === 'phone' ? sortOrder : 'asc'}
                      onClick={() => {
                        if (sortBy === 'phone') {
                          setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                        } else {
                          setSortBy('phone');
                          setSortOrder('asc');
                        }
                      }}
                    >
                      Телефон
                    </TableSortLabel>
                  </TableCell>
                  <TableCell>Категория</TableCell>
                  <TableCell>Группы</TableCell>
                  <TableCell>Тарифы</TableCell>
                  <TableCell>Баланс</TableCell>
                  <TableCell>Статус</TableCell>
                  <TableCell>
                    <TableSortLabel
                      active={sortBy === 'createdAt'}
                      direction={sortBy === 'createdAt' ? sortOrder : 'desc'}
                      onClick={() => {
                        if (sortBy === 'createdAt') {
                          setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                        } else {
                          setSortBy('createdAt');
                          setSortOrder('desc');
                        }
                      }}
                    >
                      Дата создания
                    </TableSortLabel>
                  </TableCell>
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
                    // Фильтр по группе
                    if (filterGroupId) {
                      const hasGroup = client.groupMemberships?.some(
                        (gm) => gm.group?.id === filterGroupId && gm.isActive
                      );
                      if (!hasGroup) return false;
                    }
                    return true;
                  })
                  .sort((a, b) => {
                    let aValue: any;
                    let bValue: any;
                    
                    switch (sortBy) {
                      case 'firstName':
                        aValue = `${a.firstName} ${a.lastName}`;
                        bValue = `${b.firstName} ${b.lastName}`;
                        break;
                      case 'email':
                        aValue = a.email || '';
                        bValue = b.email || '';
                        break;
                      case 'phone':
                        aValue = a.phone || '';
                        bValue = b.phone || '';
                        break;
                      case 'createdAt':
                        aValue = new Date((a as any).createdAt || 0).getTime();
                        bValue = new Date((b as any).createdAt || 0).getTime();
                        break;
                      default:
                        aValue = new Date((a as any).createdAt || 0).getTime();
                        bValue = new Date((b as any).createdAt || 0).getTime();
                    }
                    
                    if (typeof aValue === 'string' && typeof bValue === 'string') {
                      return sortOrder === 'asc' 
                        ? aValue.localeCompare(bValue)
                        : bValue.localeCompare(aValue);
                    } else {
                      return sortOrder === 'asc' 
                        ? (aValue > bValue ? 1 : -1)
                        : (aValue < bValue ? 1 : -1);
                    }
                  })
                  .map((client) => (
                  <TableRow key={client.id}>
                    <TableCell>
                      {client.firstName} {client.lastName}
                    </TableCell>
                    <TableCell>{client.email || '-'}</TableCell>
                    <TableCell>
                      {editingPhoneClientId === client.id ? (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <TextField
                            size="small"
                            value={editingPhoneValue}
                            onChange={(e) => setEditingPhoneValue(e.target.value)}
                            placeholder="+1234567890"
                            autoFocus
                            sx={{ width: 150 }}
                          />
                          <IconButton
                            size="small"
                            color="primary"
                            onClick={async () => {
                              try {
                                await apiService.updateClient(client.id, { phone: editingPhoneValue });
                                await fetchClients();
                                setEditingPhoneClientId(null);
                                setEditingPhoneValue('');
                              } catch (err: any) {
                                setError(err.response?.data?.error || 'Ошибка обновления телефона');
                              }
                            }}
                          >
                            <Check />
                          </IconButton>
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => {
                              setEditingPhoneClientId(null);
                              setEditingPhoneValue('');
                            }}
                          >
                            <Close />
                          </IconButton>
                        </Box>
                      ) : (
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                            cursor: 'pointer',
                            '&:hover': {
                              color: 'primary.main',
                              textDecoration: 'underline'
                            }
                          }}
                          onClick={() => {
                            setEditingPhoneClientId(client.id);
                            setEditingPhoneValue(client.phone || '');
                          }}
                        >
                          <Phone sx={{ fontSize: 16 }} />
                          {client.phone || '-'}
                        </Box>
                      )}
                    </TableCell>
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
                      {client.groupMemberships && client.groupMemberships.length > 0 ? (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {client.groupMemberships
                            .filter((gm: any) => gm.isActive)
                            .map((gm: any) => (
                              <Chip
                                key={gm.id}
                                label={gm.group?.name || 'Группа'}
                                size="small"
                                onClick={() => {
                                  setSelectedClientForGroups(client);
                                  setGroupsDialog(true);
                                }}
                                sx={{
                                  cursor: 'pointer',
                                  '&:hover': {
                                    backgroundColor: 'primary.dark'
                                  }
                                }}
                              />
                            ))}
                        </Box>
                      ) : (
                        <Chip
                          label="Нет групп"
                          size="small"
                          variant="outlined"
                          onClick={() => {
                            setSelectedClientForGroups(client);
                            setGroupsDialog(true);
                          }}
                          sx={{
                            cursor: 'pointer',
                            '&:hover': {
                              backgroundColor: 'action.hover'
                            }
                          }}
                        />
                      )}
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
                      <Typography 
                        variant="body2" 
                        sx={{ 
                          fontWeight: 'bold',
                          color: client.balance !== undefined && Number(client.balance) < 0 
                            ? 'error.main' 
                            : Number(client.balance || 0) > 0 
                            ? 'success.main' 
                            : 'text.secondary'
                        }}
                      >
                        {((client.balance !== undefined ? Number(client.balance) : 0).toFixed(2))} ₽
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={client.isActive ? 'Активен' : 'Неактивен'}
                        color={client.isActive ? 'success' : 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      {(client as any).createdAt 
                        ? new Date((client as any).createdAt).toLocaleDateString('ru-RU')
                        : '-'}
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
                        title="Нормативы"
                        onClick={async () => {
                          setSelectedClientForStandards(client);
                          await handleOpenStandardsDialog(client);
                        }}
                      >
                        <Assignment />
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
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Группы</InputLabel>
                <Select
                  multiple
                  value={formData.groupIds}
                  onChange={(e) => {
                    const value = e.target.value;
                    setFormData({
                      ...formData,
                      groupIds: typeof value === 'string' ? value.split(',') : value as string[]
                    });
                  }}
                  label="Группы"
                  renderValue={(selected) => (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {(selected as string[]).map((groupId) => {
                        const group = groups.find(g => g.id === groupId);
                        return group ? (
                          <Chip key={groupId} label={group.name} size="small" />
                        ) : null;
                      })}
                    </Box>
                  )}
                >
                  {groups.filter(g => g.isActive).map((group) => (
                    <MenuItem key={group.id} value={group.id}>
                      {group.name} {group.branch ? `(${group.branch.name})` : ''}
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
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Группы</InputLabel>
                <Select
                  multiple
                  value={formData.groupIds}
                  onChange={(e) => {
                    const value = e.target.value;
                    setFormData({
                      ...formData,
                      groupIds: typeof value === 'string' ? value.split(',') : value as string[]
                    });
                  }}
                  label="Группы"
                  renderValue={(selected) => (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {(selected as string[]).map((groupId) => {
                        const group = groups.find(g => g.id === groupId);
                        return group ? (
                          <Chip key={groupId} label={group.name} size="small" />
                        ) : null;
                      })}
                    </Box>
                  )}
                >
                  {groups.filter(g => g.isActive).map((group) => (
                    <MenuItem key={group.id} value={group.id}>
                      {group.name} {group.branch ? `(${group.branch.name})` : ''}
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
          setIsDragOver(false);
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

          {/* Инструкция по импорту */}
          <Alert 
            icon={<Info />} 
            severity="info" 
            sx={{ mb: 2 }}
          >
            <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
              Инструкция по заполнению файла:
            </Typography>
            <Box component="ul" sx={{ m: 0, pl: 2 }}>
              <Typography component="li" variant="body2" sx={{ mb: 0.5 }}>
                <strong>Обязательные поля:</strong> Имя, Фамилия
              </Typography>
              <Typography component="li" variant="body2" sx={{ mb: 0.5 }}>
                <strong>Дата рождения:</strong> формат ДД.ММ.ГГГГ (например: 01.01.2010)
              </Typography>
              <Typography component="li" variant="body2" sx={{ mb: 0.5 }}>
                <strong>Пол:</strong> "Мужской", "Женский" или "Другой"
              </Typography>
              <Typography component="li" variant="body2" sx={{ mb: 0.5 }}>
                <strong>Родители:</strong> можно указать до 2 родителей, все поля опциональны
              </Typography>
              <Typography component="li" variant="body2">
                <strong>Что не указывать:</strong> Дата создания (заполняется автоматически)
              </Typography>
            </Box>
          </Alert>

          {/* Кнопка скачивания шаблона */}
          <Box sx={{ mb: 2 }}>
            <Button
              variant="outlined"
              startIcon={<Download />}
              fullWidth
              onClick={handleDownloadTemplate}
              sx={{ textTransform: 'none' }}
            >
              Скачать шаблон Excel
            </Button>
          </Box>

          {/* Drag and Drop область */}
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
                  setError('');
                  }
                }}
                style={{ display: 'none' }}
              />
            <Box
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              sx={{
                border: `2px dashed ${isDragOver ? 'primary.main' : 'grey.300'}`,
                borderRadius: 2,
                p: 4,
                textAlign: 'center',
                backgroundColor: isDragOver ? 'action.hover' : 'background.paper',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                mb: 2,
                '&:hover': {
                  borderColor: 'primary.main',
                  backgroundColor: 'action.hover'
                }
              }}
              onClick={() => fileInputRef.current?.click()}
            >
              {importFile ? (
                <Box>
                  <FileUpload sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
                  <Typography variant="h6" gutterBottom>
                    {importFile.name}
                  </Typography>
            <Typography variant="body2" color="text.secondary">
                    Нажмите для выбора другого файла
            </Typography>
                </Box>
              ) : (
                <Box>
                  <FileUpload sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
                  <Typography variant="h6" gutterBottom>
                    Перетащите файл сюда
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    или нажмите для выбора файла
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                    Поддерживаются только файлы Excel (.xlsx, .xls)
                  </Typography>
                </Box>
              )}
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => {
              if (!importing) {
                setImportDialog(false);
                setImportFile(null);
                setImportResult(null);
                setIsDragOver(false);
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

      {/* Диалог управления группами клиента */}
      <Dialog 
        open={groupsDialog} 
        onClose={() => {
          setGroupsDialog(false);
          setSelectedClientForGroups(null);
        }} 
        maxWidth="sm" 
        fullWidth
      >
        <DialogTitle>
          Управление группами: {selectedClientForGroups?.firstName} {selectedClientForGroups?.lastName}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Текущие группы:
            </Typography>
            {selectedClientForGroups?.groupMemberships?.filter((gm: any) => gm.isActive).length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Клиент не состоит ни в одной группе
              </Typography>
            ) : (
              <Box sx={{ mb: 3, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {selectedClientForGroups?.groupMemberships
                  ?.filter((gm: any) => gm.isActive)
                  .map((gm: any) => (
                    <Chip
                      key={gm.id}
                      label={gm.group?.name || 'Группа'}
                      onDelete={async () => {
                        if (window.confirm(`Удалить клиента из группы "${gm.group?.name}"?`)) {
                          try {
                            await apiService.removeClientFromGroup(gm.group?.id, selectedClientForGroups!.id);
                            await fetchClients();
                            const updatedClient = await apiService.getClient(selectedClientForGroups!.id);
                            setSelectedClientForGroups(updatedClient);
                          } catch (err: any) {
                            setError(err.response?.data?.error || 'Ошибка удаления из группы');
                            console.error('Error removing from group:', err);
                          }
                        }
                      }}
                      color="primary"
                      sx={{ backgroundColor: gm.group?.color || 'primary.main' }}
                    />
                  ))}
              </Box>
            )}
            <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
              Добавить в группу:
            </Typography>
            <FormControl fullWidth>
              <InputLabel>Выберите группу</InputLabel>
              <Select
                value=""
                onChange={async (e) => {
                  const groupId = e.target.value;
                  if (!selectedClientForGroups || !groupId) return;
                  
                  try {
                    await apiService.addClientToGroup(groupId, selectedClientForGroups.id);
                    await fetchClients();
                    const updatedClient = await apiService.getClient(selectedClientForGroups.id);
                    setSelectedClientForGroups(updatedClient);
                    // Сброс выбора
                    (e.target as any).value = '';
                  } catch (err: any) {
                    setError(err.response?.data?.error || 'Ошибка добавления в группу');
                    console.error('Error adding to group:', err);
                  }
                }}
                label="Выберите группу"
              >
                {groups
                  .filter((group) => {
                    if (!selectedClientForGroups) return false;
                    const currentGroupIds = selectedClientForGroups.groupMemberships
                      ?.filter((gm: any) => gm.isActive)
                      .map((gm: any) => gm.group?.id) || [];
                    return !currentGroupIds.includes(group.id) && group.isActive;
                  })
                  .map((group) => (
                    <MenuItem key={group.id} value={group.id}>
                      {group.name} {group.branch ? `(${group.branch.name})` : ''}
                    </MenuItem>
                  ))}
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setGroupsDialog(false);
            setSelectedClientForGroups(null);
          }}>
            Закрыть
          </Button>
        </DialogActions>
      </Dialog>

      {/* Диалог нормативов клиента */}
      <Dialog 
        open={standardsDialog} 
        onClose={() => {
          setStandardsDialog(false);
          setSelectedClientForStandards(null);
          setClientStandards([]);
        }} 
        maxWidth="md" 
        fullWidth
      >
        <DialogTitle>
          Нормативы: {selectedClientForStandards?.firstName} {selectedClientForStandards?.lastName}
        </DialogTitle>
        <DialogContent>
          {loadingClientStandards ? (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
              <CircularProgress />
            </Box>
          ) : (
            <>
              <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h6">Выполненные нормативы</Typography>
                <Button
                  variant="contained"
                  startIcon={<Add />}
                  onClick={() => {
                    setAddStandardDialog(true);
                    setSelectedStandardId('');
                    setStandardResult('');
                    setStandardResultText('');
                    setStandardStatus('completed');
                    setStandardNotes('');
                    setStandardCompletedAt(new Date().toISOString().split('T')[0]);
                  }}
                >
                  Добавить норматив
                </Button>
              </Box>

              {clientStandards.length === 0 ? (
                <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 3 }}>
                  Нет выполненных нормативов
                </Typography>
              ) : (
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Норматив</TableCell>
                        <TableCell>Дата</TableCell>
                        <TableCell>Результат</TableCell>
                        <TableCell>Статус</TableCell>
                        <TableCell>Действия</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {clientStandards.map((cs: any) => (
                        <TableRow key={cs.id}>
                          <TableCell>
                            <Typography variant="body2" fontWeight="bold">
                              {cs.standard?.name || 'Неизвестный норматив'}
                            </Typography>
                            {cs.standard?.unit && (
                              <Typography variant="caption" color="text.secondary">
                                Единица: {cs.standard.unit}
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell>
                            {new Date(cs.completedAt).toLocaleDateString('ru-RU')}
                          </TableCell>
                          <TableCell>
                            {cs.result !== null && cs.result !== undefined 
                              ? `${cs.result}${cs.standard?.unit ? ` ${cs.standard.unit}` : ''}`
                              : cs.resultText || '-'}
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={cs.status === 'completed' ? 'Выполнен' : cs.status === 'failed' ? 'Не выполнен' : 'В процессе'}
                              color={cs.status === 'completed' ? 'success' : cs.status === 'failed' ? 'error' : 'warning'}
                              size="small"
                            />
                          </TableCell>
                          <TableCell>
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleDeleteClientStandard(cs.id)}
                            >
                              <Delete />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setStandardsDialog(false);
            setSelectedClientForStandards(null);
            setClientStandards([]);
          }}>
            Закрыть
          </Button>
        </DialogActions>
      </Dialog>

      {/* Диалог добавления норматива */}
      <Dialog open={addStandardDialog} onClose={() => setAddStandardDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Добавить норматив</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <FormControl fullWidth required>
                <InputLabel>Норматив</InputLabel>
                <Select
                  value={selectedStandardId}
                  onChange={(e) => setSelectedStandardId(e.target.value)}
                  label="Норматив"
                >
                  {standards.filter(s => s.isActive).map((standard) => (
                    <MenuItem key={standard.id} value={standard.id}>
                      {standard.name} {standard.targetValue && `(цель: ${standard.targetValue}${standard.unit ? ` ${standard.unit}` : ''})`}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                type="date"
                label="Дата выполнения"
                value={standardCompletedAt}
                onChange={(e) => setStandardCompletedAt(e.target.value)}
                InputLabelProps={{ shrink: true }}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                type="number"
                label="Результат (число)"
                value={standardResult}
                onChange={(e) => setStandardResult(e.target.value)}
                helperText="Числовой результат (например, количество раз, секунды)"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Результат (текст)"
                value={standardResultText}
                onChange={(e) => setStandardResultText(e.target.value)}
                helperText="Текстовый результат"
              />
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Статус</InputLabel>
                <Select
                  value={standardStatus}
                  onChange={(e) => setStandardStatus(e.target.value)}
                  label="Статус"
                >
                  <MenuItem value="completed">Выполнен</MenuItem>
                  <MenuItem value="failed">Не выполнен</MenuItem>
                  <MenuItem value="pending">В процессе</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Примечания"
                multiline
                rows={3}
                value={standardNotes}
                onChange={(e) => setStandardNotes(e.target.value)}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddStandardDialog(false)}>Отмена</Button>
          <Button onClick={handleAddClientStandard} variant="contained" disabled={!selectedStandardId}>
            Добавить
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Clients;
