import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  TextField,
  Typography,
} from '@mui/material';
import { Add, Search } from '@mui/icons-material';
import { Link as RouterLink } from 'react-router-dom';
import { apiService } from '../../services/api';
import { colors } from '../../theme/tokens';
import MarketerSchoolRefLink from './MarketerSchoolRefLink';

const cardSx = {
  bgcolor: colors.card,
  borderRadius: '12px',
  border: '1px solid #e6edf5',
  boxShadow: '0 5px 20px rgba(29,59,105,.025)',
} as const;

type FilterKey = 'all' | 'paid' | 'work' | 'risk';

type Row = {
  id: string;
  kind: 'lead' | 'school';
  name: string;
  initials: string;
  subtitle: string;
  phone?: string;
  status: 'paid' | 'test' | 'work';
  statusLabel: string;
  plan: string;
  nextAction: string;
  risk?: boolean;
  updatedAt: number;
};

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  paid: { bg: '#e6f9f0', color: '#0c956a' },
  test: { bg: '#fff5de', color: '#b07a19' },
  work: { bg: '#eaf2ff', color: '#3167ce' },
};

function initialsFrom(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() || '')
      .join('')
      .slice(0, 2) || 'ОР'
  );
}

const MarketerClients: React.FC = () => {
  const [leads, setLeads] = useState<any[]>([]);
  const [schools, setSchools] = useState<any[]>([]);
  const [adLink, setAdLink] = useState<{ code?: string; path?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<FilterKey>('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<'new' | 'old'>('new');
  const [leadOpen, setLeadOpen] = useState(false);
  const [claimOpen, setClaimOpen] = useState(false);
  const [notes, setNotes] = useState('');
  const [claimCode, setClaimCode] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const data = await apiService.getMarketerClients();
      setLeads(data.leads || []);
      setSchools(data.schools || []);
      setAdLink(data.adLink || null);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const rows: Row[] = useMemo(() => {
    const schoolRows: Row[] = schools.map((s) => {
      const paid = s.status === 'active';
      const name = s.tenantName || s.displayCode || 'Организация';
      return {
        id: s.id,
        kind: 'school',
        name,
        initials: initialsFrom(name),
        subtitle: new Date(s.linkedAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }),
        phone: s.maskedPhone || '—',
        status: paid ? 'paid' : 'test',
        statusLabel: paid ? 'Оплачивает' : 'Пробный период',
        plan: s.planType || '—',
        nextAction: paid ? 'Подписка активна' : 'Уточнить решение',
        risk: Boolean(s.riskRank) && s.commissionRightActive !== false,
        updatedAt: new Date(s.linkedAt).getTime(),
      };
    });
    const leadRows: Row[] = leads.map((l) => {
      const name = (l.notes || '').trim() || `Лид ${l.displayCode}`;
      return {
        id: l.id,
        kind: 'lead',
        name,
        initials: initialsFrom(name),
        subtitle: new Date(l.updatedAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }),
        phone: l.maskedPhone || '—',
        status: 'work',
        statusLabel: 'Переговоры',
        plan: 'Не выбран',
        nextAction: 'Связаться с клубом',
        risk: false,
        updatedAt: new Date(l.updatedAt).getTime(),
      };
    });
    return [...schoolRows, ...leadRows];
  }, [leads, schools]);

  const counts = useMemo(() => {
    const paid = rows.filter((r) => r.status === 'paid').length;
    const work = rows.filter((r) => r.status === 'work' || r.status === 'test').length;
    const risk = rows.filter((r) => r.risk).length;
    return { all: rows.length, paid, work, risk };
  }, [rows]);

  const filtered = useMemo(() => {
    let list = rows.filter((r) => {
      if (filter === 'paid') return r.status === 'paid';
      if (filter === 'work') return r.status === 'work' || r.status === 'test';
      if (filter === 'risk') return Boolean(r.risk);
      return true;
    });
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((r) => r.name.toLowerCase().includes(q) || r.initials.toLowerCase().includes(q));
    list = list.sort((a, b) => (sort === 'new' ? b.updatedAt - a.updatedAt : a.updatedAt - b.updatedAt));
    return list;
  }, [rows, filter, search, sort]);

  const createLead = async () => {
    try {
      setSaving(true);
      await apiService.createMarketerLead({ notes, status: 'NEW', source: 'MANUAL' });
      setLeadOpen(false);
      setNotes('');
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось создать лид');
    } finally {
      setSaving(false);
    }
  };

  const claim = async () => {
    try {
      setSaving(true);
      await apiService.claimMarketerClient(claimCode.trim());
      setClaimOpen(false);
      setClaimCode('');
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось закрепить школу');
    } finally {
      setSaving(false);
    }
  };

  const exportCsv = () => {
    const header = 'Организация;Статус;Тариф;Телефон;Действие\n';
    const body = filtered
      .map((r) => [r.name, r.statusLabel, r.plan, r.phone || '', r.nextAction].map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';'))
      .join('\n');
    const blob = new Blob([header + body], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'organizations.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py={6}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%', minWidth: 0, pb: 2, maxWidth: 1580 }}>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          justifyContent: 'space-between',
          gap: 2,
          mb: 2.5,
        }}
      >
        <Box>
          <Typography sx={{ fontSize: 12, color: '#7c8aa2', mb: 0.75 }}>Партнёрская программа / Клиенты</Typography>
          <Typography sx={{ fontWeight: 800, fontSize: { xs: 24, md: 27 }, color: '#13213a', letterSpacing: '-0.03em' }}>
            Мои организации
          </Typography>
          <Typography sx={{ mt: 0.75, color: '#7a889e', fontSize: 12 }}>
            База лидов и школ, статусы оплат и действия по клиентам.
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignSelf: { sm: 'center' } }}>
          <Button variant="outlined" onClick={() => setClaimOpen(true)} sx={{ textTransform: 'none', fontWeight: 700, borderRadius: '8px' }}>
            Закрепить школу
          </Button>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => setLeadOpen(true)}
            sx={{
              textTransform: 'none',
              fontWeight: 750,
              borderRadius: '8px',
              bgcolor: '#2463ed',
              '&:hover': { bgcolor: '#124fcf' },
            }}
          >
            Добавить организацию
          </Button>
        </Box>
      </Box>

      <MarketerSchoolRefLink adLink={adLink} variant="strip" />

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' },
          gap: 1.5,
          mb: 2.5,
        }}
      >
        {[
          { label: 'Всего в моей базе', value: String(counts.all) },
          { label: 'Оплачивают тариф', value: String(counts.paid) },
          { label: 'В работе', value: String(counts.work) },
          { label: 'Комиссии под риском', value: `${counts.risk} клуба`, warn: true },
        ].map((m) => (
          <Box key={m.label} sx={{ ...cardSx, p: 2 }}>
            <Typography sx={{ fontSize: 11, color: '#7e8ba1', mb: 1 }}>{m.label}</Typography>
            <Typography sx={{ fontWeight: 800, fontSize: 22, color: m.warn ? '#b07a19' : '#13213a' }}>{m.value}</Typography>
          </Box>
        ))}
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(0,1.7fr) minmax(260px,.8fr)' },
          gap: 2,
          alignItems: 'start',
        }}
      >
        <Box sx={{ ...cardSx, p: { xs: 1.75, md: 2.5 } }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, mb: 2, flexWrap: 'wrap' }}>
            <Box>
              <Typography sx={{ fontWeight: 800, fontSize: 16 }}>Клиентская база</Typography>
              <Typography sx={{ fontSize: 11, color: '#8390a4', mt: 0.5 }}>Поиск, фильтры и статусы организаций</Typography>
            </Box>
            <Button size="small" onClick={exportCsv} sx={{ textTransform: 'none', fontWeight: 700 }}>
              Экспорт CSV
            </Button>
          </Box>

          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
            <TextField
              size="small"
              placeholder="Поиск по названию…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              InputProps={{
                startAdornment: (
                  <Search sx={{ fontSize: 18, color: colors.textHint, mr: 1, flexShrink: 0 }} />
                ),
              }}
              sx={{
                minWidth: 200,
                flex: 1,
                '& .MuiOutlinedInput-root': { borderRadius: '8px' },
              }}
            />
            <TextField
              select
              size="small"
              value={sort}
              onChange={(e) => setSort(e.target.value as 'new' | 'old')}
              sx={{ minWidth: 160, '& .MuiOutlinedInput-root': { borderRadius: '8px' } }}
            >
              <MenuItem value="new">Сначала новые</MenuItem>
              <MenuItem value="old">Сначала старые</MenuItem>
            </TextField>
          </Box>

          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
            {(
              [
                ['all', `Все ${counts.all}`],
                ['paid', `Оплачивают ${counts.paid}`],
                ['work', `В работе ${counts.work}`],
                ['risk', `Под риском ${counts.risk}`],
              ] as Array<[FilterKey, string]>
            ).map(([key, label]) => (
              <Button
                key={key}
                size="small"
                onClick={() => setFilter(key)}
                sx={{
                  textTransform: 'none',
                  fontWeight: 700,
                  borderRadius: '6px',
                  bgcolor: filter === key ? '#eaf2ff' : colors.surface,
                  color: filter === key ? '#1753db' : colors.textMuted,
                }}
              >
                {label}
              </Button>
            ))}
          </Box>

          <Box sx={{ overflowX: 'auto' }}>
            <Box
              component="table"
              sx={{
                width: '100%',
                borderCollapse: 'collapse',
                '& th': {
                  fontSize: 10,
                  color: '#94a1b3',
                  textAlign: 'left',
                  fontWeight: 700,
                  p: '12px 10px',
                  bgcolor: '#f7f9fd',
                },
                '& td': {
                  fontSize: 12,
                  p: '14px 10px',
                  borderBottom: '1px solid #eef2f7',
                  color: '#52647d',
                  verticalAlign: 'middle',
                },
                '& tr:last-of-type td': { borderBottom: 0 },
              }}
            >
              <thead>
                <tr>
                  <th>Организация</th>
                  <Box component="th" sx={{ display: { xs: 'none', md: 'table-cell' } }}>
                    Телефон
                  </Box>
                  <th>Статус</th>
                  <Box component="th" sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
                    Тариф
                  </Box>
                  <Box component="th" sx={{ display: { xs: 'none', lg: 'table-cell' } }}>
                    След. действие
                  </Box>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6}>
                      <Typography sx={{ color: '#8c9bb0', py: 3, textAlign: 'center' }}>Ничего не найдено</Typography>
                    </td>
                  </tr>
                ) : (
                  filtered.map((r) => {
                    const tag = STATUS_STYLE[r.status];
                    return (
                      <tr key={`${r.kind}-${r.id}`}>
                        <td>
                          <Box sx={{ display: 'flex', gap: 1.25, alignItems: 'center' }}>
                            <Box
                              sx={{
                                width: 34,
                                height: 34,
                                borderRadius: '6px',
                                bgcolor: '#eef3ff',
                                color: '#315ecb',
                                display: 'grid',
                                placeItems: 'center',
                                fontWeight: 800,
                                fontSize: 11,
                                flexShrink: 0,
                              }}
                            >
                              {r.initials}
                            </Box>
                            <Box sx={{ minWidth: 0 }}>
                              <Typography sx={{ fontWeight: 750, color: '#23344f', fontSize: 12, wordBreak: 'break-word' }}>
                                {r.name}
                              </Typography>
                              <Typography sx={{ fontSize: 10, color: '#8a98ae' }}>{r.subtitle}</Typography>
                            </Box>
                          </Box>
                        </td>
                        <Box component="td" sx={{ display: { xs: 'none', md: 'table-cell' } }}>
                          {r.phone}
                        </Box>
                        <td>
                          <Box
                            component="span"
                            sx={{
                              display: 'inline-flex',
                              borderRadius: '6px',
                              px: 1,
                              py: 0.5,
                              fontSize: 10,
                              fontWeight: 750,
                              bgcolor: tag.bg,
                              color: tag.color,
                            }}
                          >
                            ● {r.statusLabel}
                          </Box>
                          {r.risk && (
                            <Typography sx={{ fontSize: 10, color: '#c0392b', fontWeight: 700, mt: 0.5 }}>
                              Комиссия под риском
                            </Typography>
                          )}
                        </td>
                        <Box component="td" sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
                          {r.plan}
                        </Box>
                        <Box component="td" sx={{ display: { xs: 'none', lg: 'table-cell' } }}>
                          {r.nextAction}
                        </Box>
                        <td>
                          <Button
                            component={RouterLink}
                            to={`/marketer/clients/${r.id}`}
                            size="small"
                            sx={{ textTransform: 'none', fontWeight: 700, color: '#2364de' }}
                          >
                            Открыть
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </Box>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box sx={{ ...cardSx, p: 2 }}>
            <Typography sx={{ fontWeight: 800, mb: 1 }}>Как считается активность?</Typography>
            <Typography sx={{ fontSize: 12, color: '#71819a', lineHeight: 1.6 }}>
              В счётчик периода входят только новые организации с первой успешной оплатой. Невыполнение порога 3/3
              ставит под риск комиссии по трём самым ранним клиентам.
            </Typography>
            <Button component={RouterLink} to="/marketer/activity" sx={{ textTransform: 'none', fontWeight: 700, mt: 1, px: 0 }}>
              Открыть активность →
            </Button>
          </Box>
          <Box sx={{ ...cardSx, p: 2, bgcolor: '#eff5ff', borderColor: '#dfebff' }}>
            <Typography sx={{ fontWeight: 800, fontSize: 13, color: '#1e4283', mb: 0.75 }}>Быстрые действия</Typography>
            <Button fullWidth onClick={() => setLeadOpen(true)} sx={{ textTransform: 'none', fontWeight: 700, justifyContent: 'flex-start' }}>
              + Новая организация
            </Button>
            <Button fullWidth onClick={() => setClaimOpen(true)} sx={{ textTransform: 'none', fontWeight: 700, justifyContent: 'flex-start' }}>
              Закрепить школу по коду
            </Button>
          </Box>
        </Box>
      </Box>

      <Dialog open={leadOpen} onClose={() => setLeadOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ fontWeight: 800 }}>Добавить организацию</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Контакты в кабинете показываются только в маске. Укажите заметку с названием клуба.
          </Typography>
          <TextField fullWidth multiline minRows={3} label="Название / заметка" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLeadOpen(false)} sx={{ textTransform: 'none' }}>
            Отмена
          </Button>
          <Button variant="contained" disabled={saving} onClick={() => void createLead()} sx={{ textTransform: 'none', fontWeight: 700 }}>
            Сохранить
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={claimOpen} onClose={() => setClaimOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ fontWeight: 800 }}>Закрепить школу</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Subdomain школы или код рефералки"
            value={claimCode}
            onChange={(e) => setClaimCode(e.target.value)}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setClaimOpen(false)} sx={{ textTransform: 'none' }}>
            Отмена
          </Button>
          <Button
            variant="contained"
            disabled={saving || !claimCode.trim()}
            onClick={() => void claim()}
            sx={{ textTransform: 'none', fontWeight: 700 }}
          >
            Закрепить
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default MarketerClients;
