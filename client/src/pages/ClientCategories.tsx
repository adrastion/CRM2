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
} from '@mui/material';
import { Add, Edit, Delete } from '@mui/icons-material';
import { apiService } from '../services/api';
import { ClientCategory } from '../types';

const ClientCategories: React.FC = () => {
  const [categories, setCategories] = useState<ClientCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [openDialog, setOpenDialog] = useState(false);
  const [editDialog, setEditDialog] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ClientCategory | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    color: '#1976d2',
  });

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const response = await apiService.getClientCategories();
      setCategories(response.data);
    } catch (err: any) {
      setError('Не удалось загрузить категории');
      console.error('Categories error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleCreateCategory = async () => {
    if (!formData.name.trim()) {
      setError('Название категории обязательно');
      return;
    }

    try {
      await apiService.createClientCategory(formData);
      await fetchCategories();
      setOpenDialog(false);
      setFormData({ name: '', description: '', color: '#1976d2' });
      setError('');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Не удалось создать категорию');
    }
  };

  const handleEditCategory = (category: ClientCategory) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      description: category.description || '',
      color: category.color || '#1976d2',
    });
    setEditDialog(true);
  };

  const handleUpdateCategory = async () => {
    if (!editingCategory || !formData.name.trim()) {
      setError('Название категории обязательно');
      return;
    }

    try {
      await apiService.updateClientCategory(editingCategory.id, formData);
      await fetchCategories();
      setEditDialog(false);
      setEditingCategory(null);
      setFormData({ name: '', description: '', color: '#1976d2' });
      setError('');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Не удалось обновить категорию');
    }
  };

  const handleDeleteCategory = async (categoryId: string) => {
    if (window.confirm('Вы уверены, что хотите удалить эту категорию?')) {
      try {
        await apiService.deleteClientCategory(categoryId);
        await fetchCategories();
      } catch (err: any) {
        setError(err?.response?.data?.error || 'Не удалось удалить категорию');
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
          Категории клиентов
        </Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => {
            setOpenDialog(true);
            setFormData({ name: '', description: '', color: '#1976d2' });
            setError('');
          }}
        >
          Добавить категорию
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
                  <TableCell>Цвет</TableCell>
                  <TableCell>Статус</TableCell>
                  <TableCell>Действия</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {categories.map((category) => (
                  <TableRow key={category.id}>
                    <TableCell>{category.name}</TableCell>
                    <TableCell>{category.description || '-'}</TableCell>
                    <TableCell>
                      <Chip
                        label={category.color || '#1976d2'}
                        size="small"
                        sx={{
                          backgroundColor: category.color || '#1976d2',
                          color: 'white'
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={category.isActive ? 'Активна' : 'Неактивна'}
                        color={category.isActive ? 'success' : 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <IconButton
                        size="small"
                        onClick={() => handleEditCategory(category)}
                      >
                        <Edit />
                      </IconButton>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => handleDeleteCategory(category.id)}
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

      {/* Диалог создания категории */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Добавить категорию</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Название категории"
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
            <Grid item xs={12}>
              <TextField
                fullWidth
                type="color"
                label="Цвет"
                value={formData.color}
                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Отмена</Button>
          <Button onClick={handleCreateCategory} variant="contained">
            Создать
          </Button>
        </DialogActions>
      </Dialog>

      {/* Диалог редактирования категории */}
      <Dialog open={editDialog} onClose={() => setEditDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Редактировать категорию</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Название категории"
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
            <Grid item xs={12}>
              <TextField
                fullWidth
                type="color"
                label="Цвет"
                value={formData.color}
                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialog(false)}>Отмена</Button>
          <Button onClick={handleUpdateCategory} variant="contained">
            Сохранить изменения
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ClientCategories;

