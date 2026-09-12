import React from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Menu,
  MenuItem,
  Snackbar,
  Stack,
  Typography,
} from '@mui/material';
import {
  Add,
  EditOutlined,
  MoreHoriz,
  SaveOutlined,
  Close,
} from '@mui/icons-material';
import { apiService } from '../../services/api';
import { Group } from '../../types';
import { colors, typography } from '../../theme/tokens';
import { AthleteCardProps, AthleteCardData } from './athleteCardTypes';
import { buildCalendarEvents, fullName } from './athleteCardUtils';
import AthleteProfileHeader from './AthleteProfileHeader';
import AthleteStandardsAccordion from './AthleteStandardsAccordion';
import AthletePersonalCalendar from './AthletePersonalCalendar';
import AthleteCompetitionResults from './AthleteCompetitionResults';
import AthletePersonalDocs from './AthletePersonalDocs';
import AthleteContracts from './AthleteContracts';
import AthleteParents from './AthleteParents';
import ClientGroupsDialog from '../client/ClientGroupsDialog';
import { useAuth } from '../../contexts/AuthContext';
import { isOwnerOrAdmin } from '../../utils/roles';

async function loadStaffCard(clientId: string): Promise<AthleteCardData> {
  const client = await apiService.getClient(clientId);
  const [standardsRes, competitionsRes, attendancesRes, trainingsRes] = await Promise.all([
    apiService.getClientStandards(clientId).catch(() => ({ data: [] })),
    apiService.getCompetitions().catch(() => ({ data: [] })),
    apiService.getAttendances({ clientId }).catch(() => ({ data: [] })),
    apiService.getTrainings().catch(() => ({ data: [] })),
  ]);

  const groupIds =
    client.groupMemberships
      ?.filter((gm: any) => gm.isActive !== false)
      .map((gm: any) => gm.group?.id || gm.groupId)
      .filter(Boolean) || [];

  const trainingsFromAtt = (attendancesRes.data || [])
    .map((a: any) => a.training)
    .filter((t: any) => t && !t.isCancelled);
  const trainingsFromGroups = (trainingsRes.data || []).filter(
    (t: any) => groupIds.includes(t.groupId) && !t.isCancelled
  );
  const trainingMap = new Map<string, any>();
  [...trainingsFromAtt, ...trainingsFromGroups].forEach((t: any) => {
    if (t?.id) trainingMap.set(t.id, t);
  });

  const competitionResults: any[] = [];
  for (const competition of competitionsRes.data || []) {
    const participant = competition.participants?.find((p: any) => p.clientId === clientId);
    if (!participant || !competition.results?.length) continue;
    competition.results
      .filter((r: any) => r.participantId === participant.id)
      .forEach((r: any) => {
        competitionResults.push({
          ...r,
          competition: {
            id: competition.id,
            name: competition.name,
            location: competition.location,
            startDate: competition.startDate || competition.date,
            endDate: competition.endDate,
          },
        });
      });
  }
  competitionResults.sort((a, b) => {
    const da = new Date(a.competition?.startDate || 0).getTime();
    const db = new Date(b.competition?.startDate || 0).getTime();
    return db - da;
  });

  const competitions = (competitionsRes.data || []).filter((c: any) =>
    c.participants?.some((p: any) => p.clientId === clientId)
  );

  return {
    ...client,
    standards: standardsRes.data || [],
    competitionResults,
    calendar: {
      trainings: Array.from(trainingMap.values()),
      competitions,
    },
  };
}

const AthleteCard: React.FC<AthleteCardProps> = ({
  mode,
  clientId,
  initialData,
  onSaved,
  onClose,
  docsAccess = 'full',
  onTrainerClick,
}) => {
  const { user } = useAuth();
  const canManageContracts = mode === 'staff' && isOwnerOrAdmin(user?.role);
  const [data, setData] = React.useState<AthleteCardData | null>(initialData || null);
  const [loading, setLoading] = React.useState(!initialData);
  const [error, setError] = React.useState('');
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState<Partial<AthleteCardData>>({});
  const [saving, setSaving] = React.useState(false);
  const [snack, setSnack] = React.useState('');
  const [addAnchor, setAddAnchor] = React.useState<null | HTMLElement>(null);
  const [moreAnchor, setMoreAnchor] = React.useState<null | HTMLElement>(null);
  const [removeParentIdx, setRemoveParentIdx] = React.useState<number | null>(null);
  const [addStandardToken, setAddStandardToken] = React.useState(0);
  const [groupsDialog, setGroupsDialog] = React.useState(false);
  const [groupsCatalog, setGroupsCatalog] = React.useState<Group[]>([]);

  const reload = React.useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      if (mode === 'client') {
        const card = await apiService.getAthleteCard(clientId);
        setData(card);
      } else {
        if (!clientId) throw new Error('clientId required');
        const card = await loadStaffCard(clientId);
        setData(card);
      }
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || 'Не удалось загрузить карточку');
    } finally {
      setLoading(false);
    }
  }, [mode, clientId]);

  React.useEffect(() => {
    if (initialData) {
      setData(initialData);
      setLoading(false);
      return;
    }
    reload();
  }, [initialData, reload]);

  const patchDraft = (patch: Partial<AthleteCardData>) => setDraft((d) => ({ ...d, ...patch }));

  const startEdit = () => {
    if (!data) return;
    setDraft({
      firstName: data.firstName,
      lastName: data.lastName,
      middleName: data.middleName,
      email: data.email,
      phone: data.phone,
      dateOfBirth: data.dateOfBirth,
      gender: data.gender,
      weight: data.weight,
      address: data.address,
      photo: data.photo,
      discipline: data.discipline,
      weightCategory: data.weightCategory,
      athleteStatus: data.athleteStatus || 'active',
      birthCertificateNumber: data.birthCertificateNumber,
      medicalCertificateNumber: data.medicalCertificateNumber,
      passportSeries: data.passportSeries,
      passportNumber: data.passportNumber,
      passportIssueDate: data.passportIssueDate,
      passportIssuedBy: data.passportIssuedBy,
      passportDivisionCode: data.passportDivisionCode,
      passportBirthPlace: data.passportBirthPlace,
      parents: data.parents || [],
    });
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setDraft({});
  };

  const save = async () => {
    if (!data?.id || mode !== 'staff') return;
    setSaving(true);
    try {
      const parentsPayload = (draft.parents || data.parents || []).map((p: any) => ({
        fullName: p.fullName,
        phone: p.phone || null,
        email: p.email || null,
        workplace: p.workplace || null,
        workplaceContact: p.workplaceContact || null,
        relationType: p.relationType || null,
        isPrimaryContact: Boolean(p.isPrimaryContact),
      }));
      const payload: any = {
        firstName: draft.firstName,
        lastName: draft.lastName,
        middleName: draft.middleName || null,
        email: draft.email || null,
        phone: draft.phone || null,
        dateOfBirth: draft.dateOfBirth || null,
        gender: draft.gender || null,
        weight: draft.weight ?? null,
        address: draft.address || null,
        photo: draft.photo || null,
        discipline: draft.discipline || null,
        weightCategory: draft.weightCategory || null,
        athleteStatus: draft.athleteStatus || 'active',
        birthCertificateNumber: draft.birthCertificateNumber || null,
        medicalCertificateNumber: draft.medicalCertificateNumber || null,
        passportSeries: draft.passportSeries || null,
        passportNumber: draft.passportNumber || null,
        passportIssueDate: draft.passportIssueDate || null,
        passportIssuedBy: draft.passportIssuedBy || null,
        passportDivisionCode: draft.passportDivisionCode || null,
        passportBirthPlace: draft.passportBirthPlace || null,
        parents: parentsPayload,
      };
      if ('birthCertificate' in draft) {
        payload.birthCertificate = draft.birthCertificate || null;
      }
      if ('medicalCertificate' in draft) {
        payload.medicalCertificate = draft.medicalCertificate || null;
      }
      await apiService.updateClient(data.id, payload);
      setSnack('Сохранено');
      setEditing(false);
      setDraft({});
      const refreshed = await loadStaffCard(data.id);
      setData(refreshed);
      onSaved?.(refreshed);
    } catch (e: any) {
      setSnack(e?.response?.data?.error || 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress size={32} />
      </Box>
    );
  }

  if (error || !data) {
    return <Alert severity="error">{error || 'Карточка не найдена'}</Alert>;
  }

  const standards = data.standards || data.clientStandards || [];
  const results = data.competitionResults || [];
  const events = buildCalendarEvents(data);
  const parents = (editing ? draft.parents : data.parents) || [];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 1,
          flexWrap: 'wrap',
        }}
      >
        <Typography sx={{ fontSize: typography.panelTitle, fontWeight: 700, color: colors.text }}>
          Карточка спортсмена
          {mode === 'client' ? '' : `: ${fullName(data)}`}
        </Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap">
          {mode === 'staff' && !editing && (
            <>
              <Button
                size="small"
                variant="contained"
                startIcon={<EditOutlined />}
                onClick={startEdit}
                sx={{ textTransform: 'none' }}
              >
                Редактировать
              </Button>
              <Button
                size="small"
                variant="outlined"
                startIcon={<Add />}
                onClick={(e) => setAddAnchor(e.currentTarget)}
                sx={{ textTransform: 'none' }}
              >
                Добавить информацию
              </Button>
              <Button
                size="small"
                variant="text"
                startIcon={<MoreHoriz />}
                onClick={(e) => setMoreAnchor(e.currentTarget)}
                sx={{ textTransform: 'none' }}
              >
                Ещё
              </Button>
            </>
          )}
          {mode === 'staff' && editing && (
            <>
              <Button
                size="small"
                variant="contained"
                startIcon={<SaveOutlined />}
                disabled={saving}
                onClick={save}
                sx={{ textTransform: 'none' }}
              >
                Сохранить
              </Button>
              <Button size="small" startIcon={<Close />} onClick={cancelEdit} sx={{ textTransform: 'none' }}>
                Отмена
              </Button>
            </>
          )}
          {onClose && (
            <Button size="small" onClick={onClose} sx={{ textTransform: 'none' }}>
              Закрыть
            </Button>
          )}
        </Stack>
      </Box>

      <Menu anchorEl={addAnchor} open={Boolean(addAnchor)} onClose={() => setAddAnchor(null)}>
        <MenuItem
          onClick={() => {
            setAddAnchor(null);
            setAddStandardToken((t) => t + 1);
          }}
        >
          Норматив
        </MenuItem>
        <MenuItem
          onClick={() => {
            setAddAnchor(null);
            setSnack('Результаты соревнований добавляются в разделе «Календарный план» → Соревнования');
          }}
        >
          Результат соревнования
        </MenuItem>
        <MenuItem
          onClick={() => {
            setAddAnchor(null);
            startEdit();
          }}
        >
          Документ
        </MenuItem>
        <MenuItem
          onClick={() => {
            setAddAnchor(null);
            setSnack('События создаются в календарном плане школы');
          }}
        >
          Событие
        </MenuItem>
      </Menu>

      <Menu anchorEl={moreAnchor} open={Boolean(moreAnchor)} onClose={() => setMoreAnchor(null)}>
        <MenuItem
          onClick={() => {
            setMoreAnchor(null);
            reload();
            setSnack('Данные обновлены');
          }}
        >
          Обновить
        </MenuItem>
      </Menu>

      <AthleteProfileHeader
        data={data}
        mode={mode}
        editing={editing}
        draft={draft}
        onDraftChange={patchDraft}
        onPhotoChange={(base64) => patchDraft({ photo: base64 })}
        onGroupClick={
          mode === 'staff'
            ? async () => {
                try {
                  const res = await apiService.getGroups({ limit: 1000, page: 1 });
                  setGroupsCatalog(res.data || []);
                } catch (e) {
                  console.error(e);
                  setGroupsCatalog([]);
                }
                setGroupsDialog(true);
              }
            : undefined
        }
        onTrainerClick={mode === 'client' ? onTrainerClick : undefined}
      />

      <ClientGroupsDialog
        open={groupsDialog}
        client={data}
        groups={groupsCatalog}
        onClose={() => setGroupsDialog(false)}
        onChanged={async () => {
          await reload();
        }}
        onError={(message) => setError(message)}
        onSuccessMessage={(message) => setSnack(message)}
      />

      <AthleteStandardsAccordion
        standards={standards}
        mode={mode}
        clientId={data.id}
        groupIds={
          (data.groupMemberships || [])
            .filter((gm: any) => gm.isActive !== false)
            .map((gm: any) => gm.group?.id || gm.groupId)
            .filter(Boolean) as string[]
        }
        addRequestToken={addStandardToken}
        onChanged={reload}
        onSnack={setSnack}
      />

      <AthletePersonalCalendar
        events={events}
        onOpenFull={
          mode === 'staff'
            ? () => setSnack('Полный календарь школы — раздел «Календарный план»')
            : undefined
        }
      />

      <AthleteCompetitionResults results={results} />

      <AthletePersonalDocs
        data={data}
        mode={mode}
        editing={editing}
        draft={draft}
        onDraftChange={patchDraft}
        access={docsAccess}
        onFileUpload={(field, base64) => patchDraft({ [field]: base64 })}
      />

      {mode === 'staff' && clientId && docsAccess !== 'denied' && (
        <AthleteContracts
          clientId={clientId}
          mode={mode}
          canManage={canManageContracts}
        />
      )}

      <AthleteParents
        parents={parents as any}
        mode={mode}
        editing={editing}
        onChange={(next) => patchDraft({ parents: next as any })}
        onRemoveConfirm={(index) => setRemoveParentIdx(index)}
      />

      {data.updatedAt && (
        <Typography sx={{ fontSize: typography.hint, color: colors.textHint }}>
          Последнее изменение: {new Date(data.updatedAt).toLocaleString('ru-RU')}
        </Typography>
      )}

      <Snackbar
        open={Boolean(snack)}
        autoHideDuration={3500}
        onClose={() => setSnack('')}
        message={snack}
      />

      <Snackbar
        open={removeParentIdx != null}
        message="Удалить представителя?"
        action={
          <>
            <Button
              color="inherit"
              size="small"
              onClick={() => {
                if (removeParentIdx == null) return;
                const next = parents.filter((_, i) => i !== removeParentIdx);
                patchDraft({ parents: next as any });
                setRemoveParentIdx(null);
                setSnack('Представитель удалён из формы — сохраните изменения');
              }}
            >
              Удалить
            </Button>
            <Button color="inherit" size="small" onClick={() => setRemoveParentIdx(null)}>
              Отмена
            </Button>
          </>
        }
      />
    </Box>
  );
};

export default AthleteCard;
