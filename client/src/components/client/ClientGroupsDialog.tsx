import React, { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Typography,
} from '@mui/material';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { apiService } from '../../services/api';
import { Client, Group } from '../../types';
import { getClientAccountStatus } from '../../utils/clientAccountStatus';

type Props = {
  open: boolean;
  client: Client | null;
  groups: Group[];
  onClose: () => void;
  /** Called after membership changes; parent should refresh lists. Receives fresh client. */
  onChanged: (updatedClient: Client) => void | Promise<void>;
  onError?: (message: string) => void;
  onSuccessMessage?: (message: string) => void;
};

/**
 * Диалог управления группами клиента (как на вкладке «Клиенты»).
 */
const ClientGroupsDialog: React.FC<Props> = ({
  open,
  client,
  groups,
  onClose,
  onChanged,
  onError,
  onSuccessMessage,
}) => {
  const [localClient, setLocalClient] = useState<Client | null>(client);
  const [addGroupId, setAddGroupId] = useState('');
  const [trial, setTrial] = useState(false);
  const [trialTrainingId, setTrialTrainingId] = useState('');
  const [upcomingTrainings, setUpcomingTrainings] = useState<any[]>([]);
  const [loadingTrainings, setLoadingTrainings] = useState(false);

  useEffect(() => {
    if (open) {
      setLocalClient(client);
      setAddGroupId('');
      setTrial(false);
      setTrialTrainingId('');
      setUpcomingTrainings([]);
    }
  }, [open, client]);

  const loadUpcomingTrialTrainings = async (groupId?: string) => {
    setLoadingTrainings(true);
    try {
      const now = new Date();
      const end = new Date(now);
      end.setDate(end.getDate() + 30);
      const res = await apiService.getTrainings({
        startDate: now.toISOString(),
        endDate: end.toISOString(),
        limit: 50,
        page: 1,
      });
      let list = (res.data || []).filter((t: any) => t.groupId && !t.isCancelled);
      if (groupId) {
        list = list.filter((t: any) => t.groupId === groupId);
      }
      setUpcomingTrainings(list);
    } catch (err) {
      console.error('Failed to load trainings for trial:', err);
      setUpcomingTrainings([]);
    } finally {
      setLoadingTrainings(false);
    }
  };

  const refreshClient = async (id: string) => {
    const updated = await apiService.getClient(id);
    setLocalClient(updated);
    await onChanged(updated);
    return updated;
  };

  const handleClose = () => {
    setTrial(false);
    setTrialTrainingId('');
    setAddGroupId('');
    onClose();
  };

  const displayName = localClient
    ? [localClient.lastName, localClient.firstName, localClient.middleName].filter(Boolean).join(' ')
    : '';

  const isLead = localClient ? getClientAccountStatus(localClient) === 'lead' : false;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Управление группами: {displayName}</DialogTitle>
      <DialogContent>
        <Box sx={{ mt: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            Текущие группы:
          </Typography>
          {localClient?.groupMemberships?.filter((gm: any) => gm.isActive).length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Клиент не состоит ни в одной группе
            </Typography>
          ) : (
            <Box sx={{ mb: 3, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {localClient?.groupMemberships
                ?.filter((gm: any) => gm.isActive)
                .map((gm: any) => (
                  <Chip
                    key={gm.id}
                    label={`${gm.group?.name || 'Группа'}${gm.isTrial ? ' (пробное)' : ''}`}
                    onDelete={async () => {
                      if (!localClient) return;
                      if (!window.confirm(`Удалить клиента из группы "${gm.group?.name}"?`)) return;
                      try {
                        await apiService.removeClientFromGroup(gm.group?.id, localClient.id);
                        await refreshClient(localClient.id);
                      } catch (err: any) {
                        onError?.(err.response?.data?.error || 'Ошибка удаления из группы');
                        console.error('Error removing from group:', err);
                      }
                    }}
                    color={gm.isTrial ? 'secondary' : 'primary'}
                    sx={{ backgroundColor: gm.isTrial ? undefined : gm.group?.color || 'primary.main' }}
                  />
                ))}
            </Box>
          )}

          {isLead && (
            <FormControlLabel
              sx={{ mb: 1, display: 'flex' }}
              control={
                <Checkbox
                  checked={trial}
                  onChange={(e) => {
                    const on = e.target.checked;
                    setTrial(on);
                    setTrialTrainingId('');
                    setAddGroupId('');
                    if (on) void loadUpcomingTrialTrainings();
                  }}
                />
              }
              label="Пробное занятие"
            />
          )}

          {trial && isLead ? (
            <>
              <Typography variant="subtitle2" gutterBottom sx={{ mt: 1 }}>
                Записать на пробное занятие:
              </Typography>
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Занятие для пробы</InputLabel>
                <Select
                  value={trialTrainingId}
                  onChange={(e) => setTrialTrainingId(e.target.value)}
                  label="Занятие для пробы"
                  disabled={loadingTrainings}
                >
                  {loadingTrainings && (
                    <MenuItem value="" disabled>
                      Загрузка…
                    </MenuItem>
                  )}
                  {!loadingTrainings && upcomingTrainings.length === 0 && (
                    <MenuItem value="" disabled>
                      Нет ближайших занятий с группой
                    </MenuItem>
                  )}
                  {upcomingTrainings.map((t: any) => (
                    <MenuItem key={t.id} value={t.id}>
                      {format(new Date(t.startTime), 'dd.MM.yyyy HH:mm', { locale: ru })}
                      {' — '}
                      {t.group?.name || t.title}
                      {t.branch?.name ? ` (${t.branch.name})` : ''}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Button
                variant="contained"
                disabled={!trialTrainingId || loadingTrainings || !localClient}
                onClick={async () => {
                  if (!localClient || !trialTrainingId) return;
                  try {
                    await apiService.assignClientTrial(localClient.id, trialTrainingId);
                    await refreshClient(localClient.id);
                    setTrial(false);
                    setTrialTrainingId('');
                    onSuccessMessage?.('Клиент записан на пробное занятие');
                  } catch (err: any) {
                    onError?.(err.response?.data?.error || 'Ошибка записи на пробное занятие');
                    console.error('Error assigning trial from groups dialog:', err);
                  }
                }}
                sx={{ textTransform: 'none' }}
              >
                Записать на пробу
              </Button>
            </>
          ) : (
            <>
              <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
                Добавить в группу:
              </Typography>
              <FormControl fullWidth>
                <InputLabel>Выберите группу</InputLabel>
                <Select
                  value={addGroupId}
                  onChange={async (e) => {
                    const groupId = e.target.value;
                    if (!localClient || !groupId) return;
                    try {
                      await apiService.addClientToGroup(groupId, localClient.id);
                      await refreshClient(localClient.id);
                      setAddGroupId('');
                    } catch (err: any) {
                      onError?.(err.response?.data?.error || 'Ошибка добавления в группу');
                      console.error('Error adding to group:', err);
                      setAddGroupId('');
                    }
                  }}
                  label="Выберите группу"
                >
                  {groups
                    .filter((group) => {
                      if (!localClient) return false;
                      const currentGroupIds =
                        localClient.groupMemberships
                          ?.filter((gm: any) => gm.isActive && !gm.isTrial)
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
            </>
          )}

          {!localClient && <Alert severity="warning">Клиент не выбран</Alert>}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Закрыть</Button>
      </DialogActions>
    </Dialog>
  );
};

export default ClientGroupsDialog;
