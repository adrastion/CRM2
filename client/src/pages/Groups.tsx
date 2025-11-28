import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Checkbox,
  ListItemText,
  Link,
} from '@mui/material';
import { Add, Edit, Delete, Visibility, People } from '@mui/icons-material';
import { apiService } from '../services/api';
import { Group, Branch, Trainer, Client } from '../types';

const Groups: React.FC = () => {
  const navigate = useNavigate();
  const [groups, setGroups] = useState<Group[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [editDialog, setEditDialog] = useState(false);
  const [membersDialog, setMembersDialog] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    maxMembers: '',
    ageMin: '',
    ageMax: '',
    color: '#1976d2', // Цвет по умолчанию
    trainingPrice: '',
    branchId: '',
    trainerId: '',
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [groupsRes, branchesRes, trainersRes, clientsRes] = await Promise.all([
        apiService.getGroups(),
        apiService.getBranches(),
        apiService.getTrainers(),
        apiService.getClients({ limit: 100 }),
      ]);
      setGroups(groupsRes.data);
      setBranches(branchesRes.data);
      setTrainers(trainersRes.data);
      setClients(clientsRes.data);
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
        const [groupsRes, branchesRes, trainersRes, clientsRes] = await Promise.all([
          apiService.getGroups(undefined, abortController.signal),
          apiService.getBranches(undefined, abortController.signal),
          apiService.getTrainers(undefined, abortController.signal),
          apiService.getClients({ limit: 100 }, abortController.signal),
        ]);
        if (!isMounted || abortController.signal.aborted) return;
        setGroups(groupsRes.data);
        setBranches(branchesRes.data);
        setTrainers(trainersRes.data);
        setClients(clientsRes.data);
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
  }, []);

  const handleCreateGroup = async () => {
    try {
      const groupData = {
        ...formData,
        maxMembers: formData.maxMembers ? parseInt(formData.maxMembers) : undefined,
        ageMin: formData.ageMin ? parseInt(formData.ageMin) : undefined,
        ageMax: formData.ageMax ? parseInt(formData.ageMax) : undefined,
      };
      await apiService.createGroup(groupData);
      await fetchData();
      setOpenDialog(false);
      setFormData({
        name: '',
        description: '',
        maxMembers: '',
        ageMin: '',
        ageMax: '',
        color: '#1976d2',
        trainingPrice: '',
        branchId: '',
        trainerId: '',
      });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка создания группы');
      console.error('Error creating group:', err);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleEditGroup = (group: Group) => {
    setEditingGroup(group);
    setFormData({
      name: group.name || '',
      description: group.description || '',
      maxMembers: group.maxMembers?.toString() || '',
      ageMin: group.ageMin?.toString() || '',
      ageMax: group.ageMax?.toString() || '',
      color: group.color || '#1976d2',
      trainingPrice: (group as any).trainingPrice?.toString() || '',
      branchId: group.branchId || '',
      trainerId: group.trainerId || '',
    });
    setEditDialog(true);
  };

  const handleUpdateGroup = async () => {
    if (!editingGroup) return;
    
    try {
      const groupData = {
        ...formData,
        maxMembers: formData.maxMembers ? parseInt(formData.maxMembers) : undefined,
        ageMin: formData.ageMin ? parseInt(formData.ageMin) : undefined,
        ageMax: formData.ageMax ? parseInt(formData.ageMax) : undefined,
        trainingPrice: formData.trainingPrice ? parseFloat(formData.trainingPrice) : undefined,
      };
      await apiService.updateGroup(editingGroup.id, groupData);
      await fetchData();
      setEditDialog(false);
      setEditingGroup(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка обновления группы');
      console.error('Error updating group:', err);
    }
  };

  const handleDeleteGroup = async (groupId: string) => {
    if (window.confirm('Вы уверены, что хотите удалить эту группу?')) {
      try {
        await apiService.deleteGroup(groupId);
        await fetchData();
      } catch (err: any) {
        setError(err.response?.data?.error || 'Ошибка удаления группы');
        console.error('Error deleting group:', err);
      }
    }
  };

  const handleOpenMembersDialog = async (group: Group) => {
    setSelectedGroup(group);
    // Refresh group data to get latest members
    try {
      const updatedGroup = await apiService.getGroup(group.id);
      setSelectedGroup(updatedGroup);
    } catch (err: any) {
      console.error('Error fetching group:', err);
    }
    setMembersDialog(true);
  };

  const handleAddClientToGroup = async () => {
    if (!selectedGroup || !selectedClientId) return;

    try {
      await apiService.addClientToGroup(selectedGroup.id, selectedClientId);
      // Refresh group data
      const updatedGroup = await apiService.getGroup(selectedGroup.id);
      setSelectedGroup(updatedGroup);
      // Refresh groups list
      await fetchData();
      setSelectedClientId('');
      setSelectedClientIds([]);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка добавления клиента в группу');
      console.error('Error adding client to group:', err);
    }
  };

  const handleAddMultipleClientsToGroup = async () => {
    if (!selectedGroup || !selectedClientIds || selectedClientIds.length === 0) return;

    const maxMembers = selectedGroup.maxMembers;
    const currentMembers = selectedGroup.memberships?.filter(m => m.isActive).length || 0;
    
    if (maxMembers && currentMembers + selectedClientIds.length > maxMembers) {
      setError(`Нельзя добавить ${selectedClientIds.length} клиентов. Максимум участников: ${maxMembers}, сейчас: ${currentMembers}, можно добавить: ${maxMembers - currentMembers}`);
      return;
    }

    try {
      const errors: string[] = [];
      const successes: string[] = [];

      for (const clientId of selectedClientIds) {
        try {
          await apiService.addClientToGroup(selectedGroup.id, clientId);
          successes.push(clientId);
        } catch (err: any) {
          const client = clients.find(c => c.id === clientId);
          const clientName = client ? `${client.firstName} ${client.lastName}` : clientId;
          errors.push(`${clientName}: ${err.response?.data?.error || 'Ошибка добавления'}`);
        }
      }

      // Refresh group data
      const updatedGroup = await apiService.getGroup(selectedGroup.id);
      setSelectedGroup(updatedGroup);
      // Refresh groups list
      await fetchData();
      
      if (errors.length > 0) {
        setError(`Добавлено: ${successes.length}, ошибок: ${errors.length}. ${errors.join('; ')}`);
      } else {
        setError(null);
      }
      
      setSelectedClientIds([]);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка добавления клиентов в группу');
      console.error('Error adding clients to group:', err);
    }
  };

  const handleRemoveClientFromGroup = async (clientId: string) => {
    if (!selectedGroup) return;

    if (window.confirm('Вы уверены, что хотите удалить этого клиента из группы?')) {
      try {
        await apiService.removeClientFromGroup(selectedGroup.id, clientId);
        // Refresh group data
        const updatedGroup = await apiService.getGroup(selectedGroup.id);
        setSelectedGroup(updatedGroup);
        // Refresh groups list
        await fetchData();
      } catch (err: any) {
        setError(err.response?.data?.error || 'Ошибка удаления клиента из группы');
        console.error('Error removing client from group:', err);
      }
    }
  };

  // Get available clients (not already in group)
  const getAvailableClients = () => {
    if (!selectedGroup) return clients;
    const memberIds = selectedGroup.memberships?.filter(m => m.isActive).map(m => m.clientId) || [];
    return clients.filter(client => !memberIds.includes(client.id) && client.isActive);
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold' }}>
          Группы
        </Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          sx={{ textTransform: 'none' }}
          onClick={() => setOpenDialog(true)}
        >
          Добавить группу
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
                  <TableCell>Название</TableCell>
                  <TableCell>Описание</TableCell>
                  <TableCell>Филиал</TableCell>
                  <TableCell>Тренер</TableCell>
                  <TableCell>Макс. участников</TableCell>
                  <TableCell>Возраст</TableCell>
                  <TableCell>Участников</TableCell>
                  <TableCell>Статус</TableCell>
                  <TableCell>Действия</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {groups.length === 0 ? (
                <TableRow>
                    <TableCell colSpan={9} align="center">
                      <Typography variant="body2" color="text.secondary">
                        Группы не найдены
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  groups.map((group) => (
                    <TableRow key={group.id}>
                      <TableCell>
                        <Typography
                          sx={{
                            cursor: 'pointer',
                            color: 'primary.main',
                            '&:hover': {
                              textDecoration: 'underline'
                            }
                          }}
                          onClick={() => {
                            setEditingGroup(group);
                            setFormData({
                              name: group.name,
                              description: group.description || '',
                              maxMembers: group.maxMembers?.toString() || '',
                              ageMin: group.ageMin?.toString() || '',
                              ageMax: group.ageMax?.toString() || '',
                              color: group.color || '#1976d2',
                              trainingPrice: group.trainingPrice?.toString() || '',
                              branchId: group.branchId,
                              trainerId: group.trainerId,
                            });
                            setEditDialog(true);
                          }}
                        >
                          {group.name}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {group.description || '-'}
                      </TableCell>
                  <TableCell>
                        {group.branch?.name || '-'}
                  </TableCell>
                  <TableCell>
                        {group.trainer?.user 
                          ? `${group.trainer.user.lastName} ${group.trainer.user.firstName} ${group.trainer.user.middleName || ''}`.trim()
                          : '-'}
                  </TableCell>
                      <TableCell>{group.maxMembers || '-'}</TableCell>
                  <TableCell>
                        {group.ageMin && group.ageMax 
                          ? `${group.ageMin}-${group.ageMax}`
                          : group.ageMin 
                          ? `от ${group.ageMin}`
                          : group.ageMax
                          ? `до ${group.ageMax}`
                          : '-'}
                  </TableCell>
                  <TableCell>
                        {group.memberships?.filter(m => m.isActive).length || 0}
                  </TableCell>
                  <TableCell>
                        <Chip
                          label={group.isActive ? 'Активна' : 'Неактивна'}
                          color={group.isActive ? 'success' : 'default'}
                          size="small"
                        />
                  </TableCell>
                  <TableCell>
                        <IconButton 
                          size="small" 
                          color="primary" 
                          title="Управление участниками"
                          onClick={() => handleOpenMembersDialog(group)}
                        >
                          <People />
                    </IconButton>
                        <IconButton 
                          size="small" 
                          color="primary" 
                          title="Редактировать"
                          onClick={() => handleEditGroup(group)}
                        >
                      <Edit />
                    </IconButton>
                        <IconButton 
                          size="small" 
                          color="error" 
                          title="Удалить"
                          onClick={() => handleDeleteGroup(group.id)}
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

      {/* Диалог добавления группы */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Добавить новую группу</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Название группы"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Описание"
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                multiline
                rows={3}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth required>
                <InputLabel>Филиал</InputLabel>
                <Select
                  value={formData.branchId}
                  onChange={(e) => handleInputChange('branchId', e.target.value)}
                  label="Филиал"
                >
                  {branches.map((branch) => (
                    <MenuItem key={branch.id} value={branch.id}>
                      {branch.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth required>
                <InputLabel>Тренер</InputLabel>
                <Select
                  value={formData.trainerId}
                  onChange={(e) => handleInputChange('trainerId', e.target.value)}
                  label="Тренер"
                >
                  {trainers.map((trainer) => (
                    <MenuItem key={trainer.id} value={trainer.id}>
                      {trainer.user 
                        ? `${trainer.user.lastName} ${trainer.user.firstName} ${trainer.user.middleName || ''}`.trim()
                        : `Тренер #${trainer.id}`}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label="Максимум участников"
                type="number"
                value={formData.maxMembers}
                onChange={(e) => handleInputChange('maxMembers', e.target.value)}
                inputProps={{ min: 1 }}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label="Минимальный возраст"
                type="number"
                value={formData.ageMin}
                onChange={(e) => handleInputChange('ageMin', e.target.value)}
                inputProps={{ min: 0 }}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label="Максимальный возраст"
                type="number"
                value={formData.ageMax}
                onChange={(e) => handleInputChange('ageMax', e.target.value)}
                inputProps={{ min: 0 }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <TextField
                  fullWidth
                  label="Цвет группы"
                  type="color"
                  value={formData.color}
                  onChange={(e) => handleInputChange('color', e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
                <Box
                  sx={{
                    width: 40,
                    height: 40,
                    borderRadius: 1,
                    backgroundColor: formData.color,
                    border: '1px solid',
                    borderColor: 'divider'
                  }}
                />
              </Box>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Стоимость тренировки (руб.)"
                type="number"
                value={formData.trainingPrice}
                onChange={(e) => handleInputChange('trainingPrice', e.target.value)}
                inputProps={{ min: 0, step: 0.01 }}
                helperText="Стоимость одной тренировки в этой группе для одного клиента"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Отмена</Button>
          <Button 
            onClick={handleCreateGroup} 
            variant="contained"
            disabled={!formData.name || !formData.branchId || !formData.trainerId}
          >
            Создать группу
          </Button>
        </DialogActions>
      </Dialog>

      {/* Диалог редактирования группы */}
      <Dialog open={editDialog} onClose={() => setEditDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Редактировать группу</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Название группы"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Описание"
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                multiline
                rows={3}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth required>
                <InputLabel>Филиал</InputLabel>
                <Select
                  value={formData.branchId}
                  onChange={(e) => handleInputChange('branchId', e.target.value)}
                  label="Филиал"
                >
                  {branches.map((branch) => (
                    <MenuItem key={branch.id} value={branch.id}>
                      {branch.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth required>
                <InputLabel>Тренер</InputLabel>
                <Select
                  value={formData.trainerId}
                  onChange={(e) => handleInputChange('trainerId', e.target.value)}
                  label="Тренер"
                >
                  {trainers.map((trainer) => (
                    <MenuItem key={trainer.id} value={trainer.id}>
                      {trainer.user 
                        ? `${trainer.user.lastName} ${trainer.user.firstName} ${trainer.user.middleName || ''}`.trim()
                        : `Тренер #${trainer.id}`}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label="Максимум участников"
                type="number"
                value={formData.maxMembers}
                onChange={(e) => handleInputChange('maxMembers', e.target.value)}
                inputProps={{ min: 1 }}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label="Минимальный возраст"
                type="number"
                value={formData.ageMin}
                onChange={(e) => handleInputChange('ageMin', e.target.value)}
                inputProps={{ min: 0 }}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label="Максимальный возраст"
                type="number"
                value={formData.ageMax}
                onChange={(e) => handleInputChange('ageMax', e.target.value)}
                inputProps={{ min: 0 }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <TextField
                  fullWidth
                  label="Цвет группы"
                  type="color"
                  value={formData.color}
                  onChange={(e) => handleInputChange('color', e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
                <Box
                  sx={{
                    width: 40,
                    height: 40,
                    borderRadius: 1,
                    backgroundColor: formData.color,
                    border: '1px solid',
                    borderColor: 'divider'
                  }}
                />
              </Box>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Стоимость тренировки (руб.)"
                type="number"
                value={formData.trainingPrice}
                onChange={(e) => handleInputChange('trainingPrice', e.target.value)}
                inputProps={{ min: 0, step: 0.01 }}
                helperText="Стоимость одной тренировки в этой группе для одного клиента"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setEditDialog(false);
            setEditingGroup(null);
          }}>Отмена</Button>
          <Button 
            onClick={handleUpdateGroup} 
            variant="contained"
            disabled={!formData.name || !formData.branchId || !formData.trainerId}
          >
            Сохранить изменения
          </Button>
        </DialogActions>
      </Dialog>

      {/* Диалог управления участниками */}
      <Dialog open={membersDialog} onClose={() => {
        setMembersDialog(false);
        setSelectedClientId('');
        setSelectedClientIds([]);
      }} maxWidth="md" fullWidth>
        <DialogTitle>
          Участники группы: {selectedGroup?.name}
          {selectedGroup?.maxMembers && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {selectedGroup.memberships?.filter(m => m.isActive).length || 0} / {selectedGroup.maxMembers}
            </Typography>
          )}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mb: 3 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>Добавить клиентов</Typography>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Выберите клиентов (можно несколько)</InputLabel>
                  <Select
                    multiple
                    value={selectedClientIds}
                    onChange={(e) => {
                      const value = e.target.value;
                      setSelectedClientIds(typeof value === 'string' ? value.split(',') : value as string[]);
                    }}
                    label="Выберите клиентов (можно несколько)"
                    renderValue={(selected) => (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {(selected as string[]).map((clientId) => {
                          const client = getAvailableClients().find(c => c.id === clientId);
                          return client ? (
                            <Chip key={clientId} label={`${client.firstName} ${client.lastName}`} size="small" />
                          ) : null;
                        })}
                      </Box>
                    )}
                  >
                    {getAvailableClients().map((client) => (
                      <MenuItem key={client.id} value={client.id}>
                        <Checkbox checked={selectedClientIds.indexOf(client.id) > -1} />
                        <ListItemText primary={`${client.firstName} ${client.lastName}`} secondary={client.email || client.phone || ''} />
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <Button
                  fullWidth
                  variant="contained"
                  onClick={handleAddMultipleClientsToGroup}
                  disabled={
                    selectedClientIds.length === 0 || 
                    (selectedGroup?.maxMembers 
                      ? ((selectedGroup.memberships?.filter(m => m.isActive).length || 0) + selectedClientIds.length) > selectedGroup.maxMembers 
                      : false)
                  }
                  sx={{ height: '56px' }}
                >
                  Добавить выбранных ({selectedClientIds.length})
                </Button>
              </Grid>
            </Grid>
            {selectedGroup?.maxMembers && (() => {
              const currentCount = selectedGroup.memberships?.filter(m => m.isActive).length || 0;
              const willBeAdded = selectedClientIds.length;
              const totalAfter = currentCount + willBeAdded;
              const isFull = currentCount >= selectedGroup.maxMembers;
              const willExceed = totalAfter > selectedGroup.maxMembers;
              
              return (
                <Alert 
                  severity={isFull ? 'warning' : willExceed ? 'error' : 'info'} 
                  sx={{ mt: 2 }}
                >
                  {isFull 
                    ? `Группа заполнена (достигнут лимит ${selectedGroup.maxMembers} участников)`
                    : willExceed
                    ? `Нельзя добавить ${willBeAdded} клиентов. Доступно мест: ${selectedGroup.maxMembers - currentCount}. Попробуйте выбрать меньше клиентов.`
                    : `Участников: ${currentCount} / ${selectedGroup.maxMembers}. Будет добавлено: ${willBeAdded}`}
                </Alert>
              );
            })()}
          </Box>

          <Box>
            <Typography variant="h6" sx={{ mb: 2 }}>Текущие участники ({selectedGroup?.memberships?.filter(m => m.isActive).length || 0})</Typography>
            {selectedGroup?.memberships?.filter(m => m.isActive).length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                В группе пока нет участников
              </Typography>
            ) : (
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Имя</TableCell>
                      <TableCell>Email</TableCell>
                      <TableCell>Телефон</TableCell>
                      <TableCell>Дата присоединения</TableCell>
                      <TableCell>Действия</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {selectedGroup?.memberships
                      ?.filter(m => m.isActive)
                      .map((membership) => (
                        <TableRow key={membership.id}>
                          <TableCell>
                            {membership.client ? (
                              <Link
                                component="button"
                                variant="body2"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (membership.client) {
                                    navigate(`/clients?clientId=${membership.client.id}`);
                                  }
                                }}
                                sx={{
                                  cursor: 'pointer',
                                  textDecoration: 'none',
                                  '&:hover': {
                                    textDecoration: 'underline',
                                  },
                                }}
                              >
                                {membership.client.firstName} {membership.client.lastName}
                              </Link>
                            ) : (
                              '-'
                            )}
                          </TableCell>
                          <TableCell>{membership.client?.email || '-'}</TableCell>
                          <TableCell>{membership.client?.phone || '-'}</TableCell>
                          <TableCell>
                            {membership.joinedAt ? new Date(membership.joinedAt).toLocaleDateString('ru-RU') : '-'}
                          </TableCell>
                          <TableCell>
                            <IconButton
                              size="small"
                              color="error"
                              title="Удалить из группы"
                              onClick={() => handleRemoveClientFromGroup(membership.clientId)}
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
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setMembersDialog(false);
            setSelectedGroup(null);
            setSelectedClientId('');
            setSelectedClientIds([]);
          }}>Закрыть</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Groups;
