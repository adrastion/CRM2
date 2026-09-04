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
  CircularProgress,
  Alert,
  Switch,
  FormControlLabel,
} from '@mui/material';
import { Add, Edit, Delete } from '@mui/icons-material';
import { apiService } from '../services/api';
import { Standard } from '../types';

const Standards: React.FC = () => {
  const [standards, setStandards] = useState<Standard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [openDialog, setOpenDialog] = useState(false);
  const [editDialog, setEditDialog] = useState(false);
  const [editingStandard, setEditingStandard] = useState<Standard | null>(null);
  const [groups, setGroups] = useState<any[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    unit: '',
    targetValue: '',
    category: '',
    isActive: true,
  });

  const fetchStandards = async () => {
    try {
      setLoading(true);
      const response = await apiService.getStandards();
      setStandards(response.data);
      setError(''); // Очищаем ошибку при успешной загрузке
    } catch (err: any) {
      if (err.response?.status === 429) {
        setError('Слишком много запросов. Пожалуйста, подождите немного и попробуйте снова.');
      } else {
      setError('Не удалось загрузить нормативы');
      console.error('Standards error:', err);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStandards();
    // Загружаем группы только при необходимости (при открытии диалога)
  }, []);

  // Загружаем группы при открытии диалогов
  useEffect(() => {
    if (openDialog || editDialog) {
      fetchGroups();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- fetchGroups when dialogs open
  }, [openDialog, editDialog]);

  const fetchGroups = async () => {
    // Если группы уже загружены, не загружаем повторно
    if (groups.length > 0) {
      return;
    }
    try {
      const response = await apiService.getGroups({ limit: 1000, page: 1 });
      setGroups(response.data || []);
    } catch (err: any) {
      if (err.response?.status === 429) {
        setError('Слишком много запросов. Пожалуйста, подождите немного и попробуйте снова.');
      } else {
        console.error('Error loading groups:', err);
      }
    }
  };

  const handleCreateStandard = async () => {
    if (!formData.name.trim()) {
      setError('Название норматива обязательно');
      return;
    }

    try {
      const dataToSend = {
        ...formData,
        ...(selectedGroupIds.length > 0 ? { groupIds: selectedGroupIds } : {})
      };
      await apiService.createStandard(dataToSend);
      await fetchStandards();
      setOpenDialog(false);
      setFormData({ name: '', description: '', unit: '', targetValue: '', category: '', isActive: true });
      setSelectedGroupIds([]);
      setError('');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Не удалось создать норматив');
    }
  };

  const handleEditStandard = (standard: Standard) => {
    setEditingStandard(standard);
    setFormData({
      name: standard.name,
      description: standard.description || '',
      unit: standard.unit || '',
      targetValue: standard.targetValue?.toString() || '',
      category: standard.category || '',
      isActive: standard.isActive,
    });
    // Загружаем группы норматива из ответа API (если они включены)
    const standardGroups = (standard as any).groups || [];
    setSelectedGroupIds(standardGroups.map((sg: any) => sg.group?.id || sg.groupId).filter(Boolean));
    setEditDialog(true);
  };

  const handleUpdateStandard = async () => {
    if (!editingStandard || !formData.name.trim()) {
      setError('Название норматива обязательно');
      return;
    }

    try {
      const dataToSend = {
        ...formData,
        groupIds: selectedGroupIds // Передаем массив groupIds (пустой массив удалит все связи)
      };
      await apiService.updateStandard(editingStandard.id, dataToSend);
      await fetchStandards();
      setEditDialog(false);
      setEditingStandard(null);
      setFormData({ name: '', description: '', unit: '', targetValue: '', category: '', isActive: true });
      setSelectedGroupIds([]);
      setError('');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Не удалось обновить норматив');
    }
  };

  const handleDeleteStandard = async (standardId: string) => {
    if (window.confirm('Вы уверены, что хотите удалить этот норматив? Все записи о выполнении этого норматива также будут удалены.')) {
      try {
        await apiService.deleteStandard(standardId);
        await fetchStandards();
      } catch (err: any) {
        setError(err?.response?.data?.error || 'Не удалось удалить норматив');
      }
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box data-onboarding="standards-page">
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" component="h1" sx={{ fontWeight: 'bold' }}>
          Шаблоны нормативов
        </Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => {
            setOpenDialog(true);
            setFormData({ name: '', description: '', unit: '', targetValue: '', category: '', isActive: true });
            setError('');
          }}
          data-onboarding="add-standard-button"
        >
          Создать норматив
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
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
                  <TableCell>Единица измерения</TableCell>
                  <TableCell>Целевое значение</TableCell>
                  <TableCell>Категория</TableCell>
                  <TableCell>Статус</TableCell>
                  <TableCell>Действия</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {standards.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center">
                      <Typography variant="body2" color="text.secondary">
                        Нормативы не найдены
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  standards.map((standard) => (
                    <TableRow key={standard.id}>
                      <TableCell>{standard.name}</TableCell>
                      <TableCell>{standard.description || '-'}</TableCell>
                      <TableCell>{standard.unit || '-'}</TableCell>
                      <TableCell>
                        {standard.targetValue 
                          ? `${standard.targetValue}${standard.unit ? ` ${standard.unit}` : ''}`
                          : '-'}
                      </TableCell>
                      <TableCell>
                        {standard.category ? (
                          <Chip label={standard.category} size="small" variant="outlined" />
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={standard.isActive ? 'Активен' : 'Неактивен'}
                          color={standard.isActive ? 'success' : 'default'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <IconButton
                          size="small"
                          onClick={() => handleEditStandard(standard)}
                        >
                          <Edit />
                        </IconButton>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDeleteStandard(standard.id)}
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

      {/* Диалог создания норматива */}
      <Dialog 
        open={openDialog} 
        onClose={() => {
          setOpenDialog(false);
          setSelectedGroupIds([]);
        }} 
        maxWidth="sm" 
        fullWidth
      >
        <DialogTitle>Добавить норматив</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Название норматива"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Описание"
                multiline
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Единица измерения"
                placeholder="раз, секунды, метры, кг"
                value={formData.unit}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Целевое значение"
                type="number"
                value={formData.targetValue}
                onChange={(e) => setFormData({ ...formData, targetValue: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Категория"
                placeholder="сила, выносливость, скорость"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  />
                }
                label="Активен"
              />
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Группы (необязательно)</InputLabel>
                <Select
                  multiple
                  value={selectedGroupIds}
                  onChange={(e) => setSelectedGroupIds(e.target.value as string[])}
                  label="Группы (необязательно)"
                  renderValue={(selected) => {
                    const selectedGroups = groups.filter(g => selected.includes(g.id));
                    return selectedGroups.map(g => g.name).join(', ') || 'Не выбрано';
                  }}
                >
                  {groups.filter(g => g.isActive).map((group) => (
                    <MenuItem key={group.id} value={group.id}>
                      {group.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                Если группы не выбраны, норматив будет доступен для всех клиентов
              </Typography>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setOpenDialog(false);
            setSelectedGroupIds([]);
          }}>Отмена</Button>
          <Button onClick={handleCreateStandard} variant="contained">
            Создать
          </Button>
        </DialogActions>
      </Dialog>

      {/* Диалог редактирования норматива */}
      <Dialog 
        open={editDialog} 
        onClose={() => {
          setEditDialog(false);
          setSelectedGroupIds([]);
        }} 
        maxWidth="sm" 
        fullWidth
      >
        <DialogTitle>Редактировать норматив</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Название норматива"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Описание"
                multiline
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Единица измерения"
                placeholder="раз, секунды, метры, кг"
                value={formData.unit}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Целевое значение"
                type="number"
                value={formData.targetValue}
                onChange={(e) => setFormData({ ...formData, targetValue: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Категория"
                placeholder="сила, выносливость, скорость"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  />
                }
                label="Активен"
              />
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Группы (необязательно)</InputLabel>
                <Select
                  multiple
                  value={selectedGroupIds}
                  onChange={(e) => setSelectedGroupIds(e.target.value as string[])}
                  label="Группы (необязательно)"
                  renderValue={(selected) => {
                    const selectedGroups = groups.filter(g => selected.includes(g.id));
                    return selectedGroups.map(g => g.name).join(', ') || 'Не выбрано';
                  }}
                >
                  {groups.filter(g => g.isActive).map((group) => (
                    <MenuItem key={group.id} value={group.id}>
                      {group.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                Если группы не выбраны, норматив будет доступен для всех клиентов
              </Typography>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setEditDialog(false);
            setSelectedGroupIds([]);
          }}>Отмена</Button>
          <Button onClick={handleUpdateStandard} variant="contained">
            Сохранить изменения
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Standards;

