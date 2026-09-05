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
  TextField,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  useMediaQuery,
  useTheme,
  Divider,
  Stack,
} from '@mui/material';
import { Add, Edit, Delete } from '@mui/icons-material';
import { apiService } from '../services/api';
import { Membership } from '../types';

const Memberships: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isNarrow = useMediaQuery(theme.breakpoints.down('sm'));
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [editDialog, setEditDialog] = useState(false);
  const [editingMembership, setEditingMembership] = useState<Membership | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    duration: '',
    visits: '',
    type: 'monthly',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const membershipsRes = await apiService.getMemberships();
      setMemberships(membershipsRes.data || []);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка загрузки данных');
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      price: '',
      duration: '',
      visits: '',
      type: 'monthly',
    });
    setEditingMembership(null);
  };

  const handleCreateMembership = async () => {
    try {
      if (!formData.name || !formData.price || !formData.type) {
        alert('Пожалуйста, заполните все обязательные поля');
        return;
      }

      if (formData.type === 'monthly' && !formData.duration) {
        alert('Для месячного тарифа необходимо указать количество дней');
        return;
      }

      if (formData.type === 'visits' && !formData.visits) {
        alert('Для тарифа на количество посещений необходимо указать количество посещений');
        return;
      }

      const membershipData = {
        ...formData,
        price: parseFloat(formData.price),
        duration: formData.duration ? parseInt(formData.duration) : undefined,
        visits: formData.visits ? parseInt(formData.visits) : undefined,
      };

      await apiService.createMembership(membershipData);
      await fetchData();
      setOpenDialog(false);
      resetForm();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка создания тарифа');
      console.error('Error creating membership:', err);
    }
  };

  const handleEditMembership = (membership: Membership) => {
    setEditingMembership(membership);
    setFormData({
      name: membership.name || '',
      description: membership.description || '',
      price: membership.price?.toString() || '',
      duration: membership.duration?.toString() || '',
      visits: membership.visits?.toString() || '',
      type: membership.type || 'monthly',
    });
    setEditDialog(true);
  };

  const handleUpdateMembership = async () => {
    if (!editingMembership) return;

    try {
      if (!formData.name || !formData.price || !formData.type) {
        alert('Пожалуйста, заполните все обязательные поля');
        return;
      }

      if (formData.type === 'monthly' && !formData.duration) {
        alert('Для месячного тарифа необходимо указать количество дней');
        return;
      }

      if (formData.type === 'visits' && !formData.visits) {
        alert('Для тарифа на количество посещений необходимо указать количество посещений');
        return;
      }

      const membershipData = {
        ...formData,
        price: parseFloat(formData.price),
        duration: formData.duration ? parseInt(formData.duration) : undefined,
        visits: formData.visits ? parseInt(formData.visits) : undefined,
      };

      await apiService.updateMembership(editingMembership.id, membershipData);
      await fetchData();
      setEditDialog(false);
      resetForm();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка обновления тарифа');
      console.error('Error updating membership:', err);
    }
  };

  const handleDeleteMembership = async (membershipId: string) => {
    if (window.confirm('Вы уверены, что хотите удалить этот тариф?')) {
      try {
        await apiService.deleteMembership(membershipId);
        await fetchData();
      } catch (err: any) {
        setError(err.response?.data?.error || 'Ошибка удаления тарифа');
        console.error('Error deleting membership:', err);
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
    <Box data-onboarding="memberships-page">
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          justifyContent: 'space-between',
          alignItems: { xs: 'stretch', sm: 'center' },
          gap: 2,
          mb: 3,
        }}
      >
        <Typography variant="h5" component="h1" sx={{ fontWeight: 'bold', fontSize: { xs: 20, md: 24 } }}>
          Тарифы (Абонементы)
        </Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          sx={{ textTransform: 'none', width: { xs: '100%', sm: 'auto' } }}
          onClick={() => setOpenDialog(true)}
          data-onboarding="add-membership-button"
        >
          Создать тариф
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {isMobile ? (
        <Stack spacing={1.5}>
          {memberships.length === 0 ? (
            <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 3 }}>
              Тарифы не найдены
            </Typography>
          ) : (
            memberships.map((membership) => (
              <Card key={membership.id} variant="outlined">
                <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1, mb: 1 }}>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography sx={{ fontWeight: 600 }}>
                        {membership.name}
                      </Typography>
                      {membership.description && (
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{ overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}
                        >
                          {membership.description}
                        </Typography>
                      )}
                    </Box>
                    <Chip
                      label={membership.isActive ? 'Активен' : 'Неактивен'}
                      color={membership.isActive ? 'success' : 'default'}
                      size="small"
                    />
                  </Box>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1.5 }}>
                    <Chip
                      label={membership.type === 'monthly' ? 'Месячный' : 'На посещения'}
                      color={membership.type === 'monthly' ? 'primary' : 'secondary'}
                      size="small"
                    />
                    <Chip
                      label={membership.price.toLocaleString('ru-RU', {
                        style: 'currency',
                        currency: 'RUB',
                      })}
                      size="small"
                      variant="outlined"
                    />
                    <Chip
                      label={
                        membership.type === 'monthly'
                          ? `${membership.duration} дней`
                          : `${membership.visits} посещений`
                      }
                      size="small"
                      variant="outlined"
                    />
                  </Box>
                  <Divider sx={{ mb: 1 }} />
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5 }}>
                    <IconButton
                      size="small"
                      color="primary"
                      title="Редактировать"
                      onClick={() => handleEditMembership(membership)}
                    >
                      <Edit />
                    </IconButton>
                    <IconButton
                      size="small"
                      color="error"
                      title="Удалить"
                      onClick={() => handleDeleteMembership(membership.id)}
                    >
                      <Delete />
                    </IconButton>
                  </Box>
                </CardContent>
              </Card>
            ))
          )}
        </Stack>
      ) : (
      <Card>
        <CardContent>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Название</TableCell>
                  <TableCell>Описание</TableCell>
                  <TableCell>Тип</TableCell>
                  <TableCell>Стоимость</TableCell>
                  <TableCell>Параметры</TableCell>
                  <TableCell>Статус</TableCell>
                  <TableCell>Действия</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {memberships.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center">
                      <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>
                        Тарифы не найдены
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  memberships.map((membership) => (
                    <TableRow key={membership.id}>
                      <TableCell sx={{ fontWeight: 'medium' }}>
                        {membership.name}
                      </TableCell>
                      <TableCell>{membership.description || '-'}</TableCell>
                      <TableCell>
                        <Chip
                          label={membership.type === 'monthly' ? 'Месячный' : 'На посещения'}
                          color={membership.type === 'monthly' ? 'primary' : 'secondary'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        {membership.price.toLocaleString('ru-RU', {
                          style: 'currency',
                          currency: 'RUB',
                        })}
                      </TableCell>
                      <TableCell>
                        {membership.type === 'monthly'
                          ? `${membership.duration} дней`
                          : `${membership.visits} посещений`}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={membership.isActive ? 'Активен' : 'Неактивен'}
                          color={membership.isActive ? 'success' : 'default'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <IconButton
                          size="small"
                          color="primary"
                          title="Редактировать"
                          onClick={() => handleEditMembership(membership)}
                        >
                          <Edit />
                        </IconButton>
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
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
      )}

      {/* Диалог создания тарифа */}
      <Dialog open={openDialog} onClose={() => { setOpenDialog(false); resetForm(); }} maxWidth="sm" fullWidth fullScreen={isNarrow}>
        <DialogTitle>Создать тариф</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                required
                label="Название тарифа"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Описание"
                multiline
                rows={3}
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                required
                label="Стоимость (руб.)"
                type="number"
                value={formData.price}
                onChange={(e) => handleInputChange('price', e.target.value)}
                inputProps={{ min: 0, step: 0.01 }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth required>
                <InputLabel>Тип тарифа</InputLabel>
                <Select
                  value={formData.type}
                  onChange={(e) => {
                    handleInputChange('type', e.target.value);
                    // Очищаем поля при смене типа
                    if (e.target.value === 'monthly') {
                      handleInputChange('visits', '');
                    } else {
                      handleInputChange('duration', '');
                    }
                  }}
                  label="Тип тарифа"
                >
                  <MenuItem value="monthly">Месячный (на количество дней)</MenuItem>
                  <MenuItem value="visits">На количество посещений</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            {formData.type === 'monthly' ? (
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  required
                  label="Количество дней"
                  type="number"
                  value={formData.duration}
                  onChange={(e) => handleInputChange('duration', e.target.value)}
                  inputProps={{ min: 1 }}
                  helperText="На сколько дней выдается тариф"
                />
              </Grid>
            ) : (
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  required
                  label="Количество посещений"
                  type="number"
                  value={formData.visits}
                  onChange={(e) => handleInputChange('visits', e.target.value)}
                  inputProps={{ min: 1 }}
                  helperText="Сколько посещений включено в тариф"
                />
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setOpenDialog(false); resetForm(); }}>Отмена</Button>
          <Button onClick={handleCreateMembership} variant="contained">
            Создать тариф
          </Button>
        </DialogActions>
      </Dialog>

      {/* Диалог редактирования тарифа */}
      <Dialog open={editDialog} onClose={() => { setEditDialog(false); resetForm(); }} maxWidth="sm" fullWidth fullScreen={isNarrow}>
        <DialogTitle>Редактировать тариф</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                required
                label="Название тарифа"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Описание"
                multiline
                rows={3}
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                required
                label="Стоимость (руб.)"
                type="number"
                value={formData.price}
                onChange={(e) => handleInputChange('price', e.target.value)}
                inputProps={{ min: 0, step: 0.01 }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth required>
                <InputLabel>Тип тарифа</InputLabel>
                <Select
                  value={formData.type}
                  onChange={(e) => {
                    handleInputChange('type', e.target.value);
                    // Очищаем поля при смене типа
                    if (e.target.value === 'monthly') {
                      handleInputChange('visits', '');
                    } else {
                      handleInputChange('duration', '');
                    }
                  }}
                  label="Тип тарифа"
                >
                  <MenuItem value="monthly">Месячный (на количество дней)</MenuItem>
                  <MenuItem value="visits">На количество посещений</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            {formData.type === 'monthly' ? (
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  required
                  label="Количество дней"
                  type="number"
                  value={formData.duration}
                  onChange={(e) => handleInputChange('duration', e.target.value)}
                  inputProps={{ min: 1 }}
                  helperText="На сколько дней выдается тариф"
                />
              </Grid>
            ) : (
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  required
                  label="Количество посещений"
                  type="number"
                  value={formData.visits}
                  onChange={(e) => handleInputChange('visits', e.target.value)}
                  inputProps={{ min: 1 }}
                  helperText="Сколько посещений включено в тариф"
                />
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setEditDialog(false); resetForm(); }}>Отмена</Button>
          <Button onClick={handleUpdateMembership} variant="contained">
            Сохранить изменения
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Memberships;

