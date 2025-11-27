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
    } catch (err: any) {
      setError('Не удалось загрузить нормативы');
      console.error('Standards error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStandards();
  }, []);

  const handleCreateStandard = async () => {
    if (!formData.name.trim()) {
      setError('Название норматива обязательно');
      return;
    }

    try {
      await apiService.createStandard(formData);
      await fetchStandards();
      setOpenDialog(false);
      setFormData({ name: '', description: '', unit: '', targetValue: '', category: '', isActive: true });
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
    setEditDialog(true);
  };

  const handleUpdateStandard = async () => {
    if (!editingStandard || !formData.name.trim()) {
      setError('Название норматива обязательно');
      return;
    }

    try {
      await apiService.updateStandard(editingStandard.id, formData);
      await fetchStandards();
      setEditDialog(false);
      setEditingStandard(null);
      setFormData({ name: '', description: '', unit: '', targetValue: '', category: '', isActive: true });
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
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold' }}>
          Нормативы
        </Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => {
            setOpenDialog(true);
            setFormData({ name: '', description: '', unit: '', targetValue: '', category: '', isActive: true });
            setError('');
          }}
        >
          Добавить норматив
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
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
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
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Отмена</Button>
          <Button onClick={handleCreateStandard} variant="contained">
            Создать
          </Button>
        </DialogActions>
      </Dialog>

      {/* Диалог редактирования норматива */}
      <Dialog open={editDialog} onClose={() => setEditDialog(false)} maxWidth="sm" fullWidth>
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
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialog(false)}>Отмена</Button>
          <Button onClick={handleUpdateStandard} variant="contained">
            Сохранить изменения
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Standards;

