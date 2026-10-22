import React from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  Menu,
  MenuItem,
  Select,
  Snackbar,
  Typography,
} from '@mui/material';
import { apiService } from '../../services/api';
import { Group } from '../../types';
import { colors } from '../../theme/tokens';
import { AthleteCardProps, AthleteCardData } from './athleteCardTypes';
import { buildCalendarEvents } from './athleteCardUtils';
import AthleteProfileHeader from './AthleteProfileHeader';
import AthleteStandardsAccordion from './AthleteStandardsAccordion';
import AthletePersonalCalendar from './AthletePersonalCalendar';
import AthleteCompetitionResults from './AthleteCompetitionResults';
import AthletePersonalDocs from './AthletePersonalDocs';
import AthleteContracts from './AthleteContracts';
import AthleteParents from './AthleteParents';
import AthleteCardDesktopView from './AthleteCardDesktopView';
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
  fromSection = 'Клиенты',
  onFromSectionClick,
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
  const [renewOpen, setRenewOpen] = React.useState(false);
  const [renewCatalog, setRenewCatalog] = React.useState<Array<{ id: string; name: string }>>([]);
  const [renewMembershipId, setRenewMembershipId] = React.useState('');
  const [renewing, setRenewing] = React.useState(false);
  const [cardTab, setCardTab] = React.useState<
    import('./AthleteCardDesktopView').AthleteCardTab
  >('overview');
  const [actionsAnchor, setActionsAnchor] = React.useState<null | HTMLElement>(null);
  const [discountType, setDiscountType] = React.useState<'' | 'percent' | 'fixed'>('');
  const [discountValue, setDiscountValue] = React.useState('');
  const [tasks, setTasks] = React.useState<
    Array<{
      id: string;
      title: string;
      dueAt?: string | null;
      done?: boolean;
      assigneeName?: string | null;
      assigneePhoto?: string | null;
    }>
  >([]);
  const photoInputRef = React.useRef<HTMLInputElement>(null);

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

  React.useEffect(() => {
    if (!data) return;
    setDiscountType((data.personalDiscountType as '' | 'percent' | 'fixed') || '');
    setDiscountValue(
      data.personalDiscountValue != null && data.personalDiscountType
        ? String(data.personalDiscountValue)
        : ''
    );
  }, [data?.id, data?.personalDiscountType, data?.personalDiscountValue]);

  React.useEffect(() => {
    if (mode !== 'staff') return;
    void apiService
      .listStaffTasks({})
      .then((list: any[]) =>
        setTasks(
          (list || []).slice(0, 8).map((t: any) => {
            const assignee = t.assignees?.[0]?.user || t.assignees?.[0] || t.assignee;
            const assigneeName = assignee
              ? [assignee.lastName, assignee.firstName].filter(Boolean).join(' ') || assignee.name
              : null;
            return {
              id: t.id,
              title: t.title,
              dueAt: t.dueAt,
              done: t.status === 'DONE',
              assigneeName: assigneeName || null,
              assigneePhoto: assignee?.photo || assignee?.avatar || null,
            };
          })
        )
      )
      .catch(() => setTasks([]));
  }, [mode, data?.id]);

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

    const parentsSource = draft.parents || data.parents || [];
    for (let i = 0; i < parentsSource.length; i += 1) {
      const p = parentsSource[i] as any;
      const name = String(p.fullName || '').trim();
      if (name.length < 2) {
        setSnack(`У представителя ${i + 1} укажите ФИО (минимум 2 символа)`);
        return;
      }
      const email = String(p.email || '').trim();
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setSnack(`У представителя ${i + 1} некорректный email`);
        return;
      }
    }

    setSaving(true);
    try {
      const parentsPayload = parentsSource.map((p: any) => {
        const id =
          typeof p.id === 'string' && p.id && !p.id.startsWith('new-') ? p.id : undefined;
        return {
          ...(id ? { id } : {}),
          fullName: String(p.fullName || '').trim(),
          phone: p.phone || null,
          email: p.email || null,
          workplace: p.workplace || null,
          workplaceContact: p.workplaceContact || null,
          relationType: p.relationType || null,
          isPrimaryContact: Boolean(p.isPrimaryContact),
        };
      });
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
  const upcoming = events
    .filter((e) => e.type === 'training' && e.startTime && new Date(e.startTime).getTime() >= Date.now() - 86400000)
    .sort((a, b) => new Date(a.startTime || 0).getTime() - new Date(b.startTime || 0).getTime());

  const openRenew = () => {
    setRenewOpen(true);
    void apiService
      .getMemberships({ limit: 200 })
      .then((res) =>
        setRenewCatalog(
          (res.data || [])
            .filter((m: any) => m.isActive !== false && m.category !== 'GROUP')
            .map((m: any) => ({ id: m.id, name: m.name }))
        )
      )
      .catch(() => setSnack('Не удалось загрузить абонементы'));
  };

  const sharedDialogs = (
    <>
      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = () => {
            if (typeof reader.result === 'string') {
              startEdit();
              patchDraft({ photo: reader.result });
              setSnack('Фото выбрано — сохраните изменения');
            }
          };
          reader.readAsDataURL(file);
        }}
      />

      <Menu anchorEl={addAnchor} open={Boolean(addAnchor)} onClose={() => setAddAnchor(null)}>
        <MenuItem
          onClick={() => {
            setAddAnchor(null);
            setAddStandardToken((t) => t + 1);
            setCardTab('history');
          }}
        >
          Норматив
        </MenuItem>
        <MenuItem
          onClick={() => {
            setAddAnchor(null);
            setSnack('Результаты соревнований — в разделе «Календарный план»');
          }}
        >
          Результат соревнования
        </MenuItem>
        <MenuItem
          onClick={() => {
            setAddAnchor(null);
            setCardTab('documents');
            startEdit();
          }}
        >
          Документ
        </MenuItem>
        <MenuItem
          onClick={() => {
            setAddAnchor(null);
            setCardTab('notes');
          }}
        >
          Заметка
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
        <MenuItem
          onClick={() => {
            setMoreAnchor(null);
            onClose?.();
          }}
        >
          Закрыть
        </MenuItem>
      </Menu>

      <Menu anchorEl={actionsAnchor} open={Boolean(actionsAnchor)} onClose={() => setActionsAnchor(null)}>
        <MenuItem
          onClick={() => {
            setActionsAnchor(null);
            startEdit();
          }}
        >
          Редактировать
        </MenuItem>
        <MenuItem
          onClick={() => {
            setActionsAnchor(null);
            openRenew();
          }}
        >
          Продлить абонемент
        </MenuItem>
        <MenuItem
          onClick={() => {
            setActionsAnchor(null);
            setGroupsDialog(true);
            void apiService
              .getGroups({ limit: 1000, page: 1 })
              .then((r) => setGroupsCatalog(r.data || []))
              .catch(() => setGroupsCatalog([]));
          }}
        >
          Сменить группы
        </MenuItem>
      </Menu>

      <Dialog open={editing} onClose={cancelEdit} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Редактирование карточки</DialogTitle>
        <DialogContent>
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
                    } catch {
                      setGroupsCatalog([]);
                    }
                    setGroupsDialog(true);
                  }
                : undefined
            }
            onTrainerClick={mode === 'client' ? onTrainerClick : undefined}
          />
          <Box sx={{ mt: 2 }}>
            <AthleteParents
              parents={parents as any}
              mode={mode}
              editing={editing}
              onChange={(next) => patchDraft({ parents: next as any })}
              onRemoveConfirm={(index) => setRemoveParentIdx(index)}
            />
          </Box>
          <Box sx={{ mt: 2 }}>
            <AthletePersonalDocs
              data={data}
              mode={mode}
              editing={editing}
              draft={draft}
              onDraftChange={patchDraft}
              access={docsAccess}
              onFileUpload={(field, base64) => patchDraft({ [field]: base64 })}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={cancelEdit} sx={{ textTransform: 'none' }}>
            Отмена
          </Button>
          <Button
            variant="contained"
            disabled={saving}
            onClick={save}
            sx={{ textTransform: 'none', bgcolor: colors.primary, boxShadow: 'none' }}
          >
            {saving ? 'Сохранение…' : 'Сохранить'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={renewOpen} onClose={() => setRenewOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ fontWeight: 700 }}>Продлить абонемент</DialogTitle>
        <DialogContent>
          <FormControl fullWidth sx={{ mt: 1 }}>
            <InputLabel>Абонемент</InputLabel>
            <Select
              label="Абонемент"
              value={renewMembershipId}
              onChange={(e) => setRenewMembershipId(e.target.value)}
            >
              {renewCatalog.map((m) => (
                <MenuItem key={m.id} value={m.id}>
                  {m.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRenewOpen(false)} sx={{ textTransform: 'none' }}>
            Отмена
          </Button>
          <Button
            variant="contained"
            disabled={!renewMembershipId || renewing}
            sx={{ textTransform: 'none', bgcolor: colors.primary, boxShadow: 'none' }}
            onClick={() => {
              void (async () => {
                try {
                  setRenewing(true);
                  await apiService.createClientMembership({
                    clientId: data.id,
                    membershipId: renewMembershipId,
                    startDate: new Date().toISOString(),
                  });
                  setRenewOpen(false);
                  setRenewMembershipId('');
                  setSnack('Абонемент выдан');
                  await reload();
                } catch (e: any) {
                  setSnack(e?.response?.data?.error || 'Не удалось выдать абонемент');
                } finally {
                  setRenewing(false);
                }
              })();
            }}
          >
            {renewing ? 'Выдача…' : 'Выдать'}
          </Button>
        </DialogActions>
      </Dialog>

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

      <Snackbar open={Boolean(snack)} autoHideDuration={3500} onClose={() => setSnack('')} message={snack} />
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
    </>
  );

  if (mode === 'staff') {
    return (
      <Box>
        <AthleteCardDesktopView
          data={data}
          fromSection={fromSection}
          tab={cardTab}
          onTab={setCardTab}
          onFromSectionClick={onFromSectionClick || onClose}
          onClose={onClose}
          onEdit={startEdit}
          onAddMenu={setAddAnchor}
          onMoreMenu={setMoreAnchor}
          onActionsMenu={setActionsAnchor}
          onGroupClick={async () => {
            try {
              const res = await apiService.getGroups({ limit: 1000, page: 1 });
              setGroupsCatalog(res.data || []);
            } catch {
              setGroupsCatalog([]);
            }
            setGroupsDialog(true);
          }}
          onPhotoPick={() => photoInputRef.current?.click()}
          discountType={discountType}
          discountValue={discountValue}
          onDiscountType={setDiscountType}
          onDiscountValue={setDiscountValue}
          onSaveDiscount={() => {
            void (async () => {
              try {
                const type = discountType || null;
                const updated = await apiService.updateClient(data.id, {
                  personalDiscountType: type,
                  personalDiscountValue: type ? Number(discountValue) || 0 : null,
                });
                setData({ ...data, ...updated });
                setSnack('Скидка сохранена');
                onSaved?.({ ...data, ...updated });
              } catch (e: any) {
                setSnack(e?.response?.data?.error || 'Не удалось сохранить скидку');
              }
            })();
          }}
          onToggleMembershipFee={() => {
            void (async () => {
              try {
                const updated = await apiService.updateClientMembershipFeeStatus(
                  data.id,
                  !data.membershipFeePaid
                );
                setData({ ...data, ...updated });
                setSnack(updated.membershipFeePaid ? 'Взнос отмечен' : 'Отметка снята');
                onSaved?.({ ...data, ...updated });
              } catch (e: any) {
                setSnack(e?.response?.data?.error || 'Не удалось обновить взнос');
              }
            })();
          }}
          onDeleteClient={
            isOwnerOrAdmin(user?.role)
              ? () => {
                  if (!window.confirm('Удалить клиента?')) return;
                  void (async () => {
                    try {
                      await apiService.deleteClient(data.id);
                      setSnack('Клиент удалён');
                      onClose?.();
                    } catch (e: any) {
                      setSnack(e?.response?.data?.error || 'Не удалось удалить');
                    }
                  })();
                }
              : undefined
          }
          onMarkPayment={() => {
            void (async () => {
              try {
                const updated = await apiService.updateClientMembershipFeeStatus(data.id, true);
                setData({ ...data, ...updated });
                setSnack('Оплата отмечена');
              } catch (e: any) {
                setSnack(e?.response?.data?.error || 'Не удалось отметить оплату');
              }
            })();
          }}
          onRenewMembership={openRenew}
          upcoming={upcoming}
          tasks={tasks}
          notesText={(data as any).notes || (data as any).medicalNotes || null}
          tabPanels={{
            memberships: (
              <Box>
                <Typography sx={{ fontWeight: 800, mb: 1 }}>Абонементы</Typography>
                <Button variant="contained" onClick={openRenew} sx={{ textTransform: 'none', mb: 2 }}>
                  Продлить / выдать
                </Button>
                <Typography sx={{ color: '#8B93A7', fontSize: 13 }}>
                  {data.activeMembership
                    ? `Активный: ${data.activeMembership.name}`
                    : 'Нет активного абонемента'}
                </Typography>
              </Box>
            ),
            trainings: <AthletePersonalCalendar events={events} />,
            attendance: (
              <Typography sx={{ color: '#8B93A7' }}>
                Посещаемость доступна в разделе «Календарный план» и в экспорте Excel.
              </Typography>
            ),
            payments: (
              <Typography sx={{ color: '#8B93A7' }}>
                Платежи клиента — во вкладке «Финансы → Оплаты клиентов».
              </Typography>
            ),
            notes: (
              <Typography sx={{ whiteSpace: 'pre-wrap' }}>
                {(data as any).medicalNotes || 'Заметок пока нет'}
              </Typography>
            ),
            tasks: (
              <Box>
                {tasks.length === 0 ? (
                  <Typography sx={{ color: '#8B93A7' }}>Нет открытых задач</Typography>
                ) : (
                  tasks.map((t) => (
                    <Typography key={t.id} sx={{ py: 0.75, borderBottom: '1px solid #EEF1F6' }}>
                      {t.title}
                    </Typography>
                  ))
                )}
              </Box>
            ),
            documents: (
              <Box>
                <AthletePersonalDocs
                  data={data}
                  mode={mode}
                  editing={false}
                  draft={{}}
                  onDraftChange={() => undefined}
                  access={docsAccess}
                  onFileUpload={() => undefined}
                />
                {clientId && docsAccess !== 'denied' && (
                  <Box sx={{ mt: 2 }}>
                    <AthleteContracts clientId={clientId} mode={mode} canManage={canManageContracts} />
                  </Box>
                )}
              </Box>
            ),
            history: (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
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
                <AthleteCompetitionResults results={results} />
              </Box>
            ),
          }}
        />
        {sharedDialogs}
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <AthleteProfileHeader
        data={data}
        mode={mode}
        editing={editing}
        draft={draft}
        onDraftChange={patchDraft}
        onPhotoChange={(base64) => patchDraft({ photo: base64 })}
        onTrainerClick={onTrainerClick}
      />
      <AthletePersonalCalendar events={events} />
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
      <AthleteParents
        parents={parents as any}
        mode={mode}
        editing={editing}
        onChange={(next) => patchDraft({ parents: next as any })}
        onRemoveConfirm={(index) => setRemoveParentIdx(index)}
      />
      {sharedDialogs}
    </Box>
  );
};

export default AthleteCard;
