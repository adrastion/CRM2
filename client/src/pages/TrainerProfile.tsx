import React, { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  Grid,
  TextField,
  Typography,
} from '@mui/material';
import { apiService } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import TrainerDocumentsPanel from '../components/trainers/TrainerDocumentsPanel';

const TrainerProfile: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [trainerId, setTrainerId] = useState<string | null>(null);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    middleName: '',
    phone: '',
    qualification: '',
    experience: '',
    specialization: '',
    coachCategory: '',
    judgeCategory: '',
    achievements: '',
  });

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError('');
        const trainersRes = await apiService.getTrainers(undefined, undefined, false);
        const current = (trainersRes.data || []).find((t: any) => t.userId === user?.id);
        if (!current) {
          setError('Профиль тренера не найден');
          return;
        }
        const full = await apiService.getTrainer(current.id);
        setTrainerId(full.id);
        setForm({
          firstName: full.user?.firstName || '',
          lastName: full.user?.lastName || '',
          middleName: full.user?.middleName || '',
          phone: full.user?.phone || '',
          qualification: full.qualification || '',
          experience: full.experience != null ? String(full.experience) : '',
          specialization: full.specialization || '',
          coachCategory: full.coachCategory || '',
          judgeCategory: full.judgeCategory || '',
          achievements: full.achievements || '',
        });
      } catch (e: any) {
        setError(e?.response?.data?.error || 'Не удалось загрузить профиль');
      } finally {
        setLoading(false);
      }
    })();
  }, [user?.id]);

  const setField = (key: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    if (!trainerId) return;
    try {
      setSaving(true);
      setError('');
      setSuccess('');
      await apiService.updateTrainer(trainerId, {
        firstName: form.firstName,
        lastName: form.lastName,
        middleName: form.middleName,
        phone: form.phone,
        qualification: form.qualification,
        experience: form.experience,
        specialization: form.specialization,
        coachCategory: form.coachCategory,
        judgeCategory: form.judgeCategory,
        achievements: form.achievements,
      });
      setSuccess('Профиль сохранён');
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py={6}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
        Мой профиль
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Здесь вы можете указать тренерскую и судейскую категории, достижения и загрузить
        документы (дипломы, образование, сертификаты).
      </Typography>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>
          {success}
        </Alert>
      )}
      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label="Фамилия"
                value={form.lastName}
                onChange={(e) => setField('lastName', e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label="Имя"
                value={form.firstName}
                onChange={(e) => setField('firstName', e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label="Отчество"
                value={form.middleName}
                onChange={(e) => setField('middleName', e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Телефон"
                value={form.phone}
                onChange={(e) => setField('phone', e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Квалификация"
                value={form.qualification}
                onChange={(e) => setField('qualification', e.target.value)}
                placeholder="Дан, разряд, звание"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Опыт (лет)"
                type="number"
                value={form.experience}
                onChange={(e) => setField('experience', e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Специализация"
                value={form.specialization}
                onChange={(e) => setField('specialization', e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Тренерская категория"
                value={form.coachCategory}
                onChange={(e) => setField('coachCategory', e.target.value)}
                placeholder="Например: высшая, первая, вторая"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Судейская категория"
                value={form.judgeCategory}
                onChange={(e) => setField('judgeCategory', e.target.value)}
                placeholder="Например: всероссийская, первая"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                minRows={3}
                label="Достижения"
                value={form.achievements}
                onChange={(e) => setField('achievements', e.target.value)}
                placeholder="Награды, титулы, значимые результаты…"
              />
            </Grid>
          </Grid>
          <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              variant="contained"
              disabled={saving || !trainerId}
              onClick={() => void handleSave()}
              sx={{ textTransform: 'none' }}
            >
              {saving ? 'Сохранение…' : 'Сохранить'}
            </Button>
          </Box>
        </CardContent>
      </Card>

      {trainerId && (
        <Card variant="outlined">
          <CardContent>
            <Divider sx={{ mb: 2 }} />
            <TrainerDocumentsPanel trainerId={trainerId} />
          </CardContent>
        </Card>
      )}
    </Box>
  );
};

export default TrainerProfile;
