import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Tabs,
  Tab,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Button,
  TextField,
  Chip,
  Link,
} from '@mui/material';
import { apiService } from '../services/api';

const SuperAdminSupportHub: React.FC = () => {
  const [tab, setTab] = useState(0);
  const [tickets, setTickets] = useState<any[]>([]);
  const [recordings, setRecordings] = useState<any[]>([]);
  const [articles, setArticles] = useState<any[]>([]);
  const [detail, setDetail] = useState<any>(null);
  const [reply, setReply] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newBody, setNewBody] = useState('');
  const [filterChannel, setFilterChannel] = useState<string>('');

  const loadTickets = async () => {
    const data = await apiService.superAdminListSupportTickets({
      channel: filterChannel || undefined,
    });
    setTickets(data.tickets || []);
  };

  const loadRecordings = async () => {
    const data = await apiService.superAdminListDesignerRecordings();
    setRecordings(data.recordings || []);
  };

  const loadKnowledge = async () => {
    const data = await apiService.superAdminListSupportKnowledge();
    setArticles(data.articles || []);
  };

  useEffect(() => {
    if (tab === 0) loadTickets();
    if (tab === 1) loadRecordings();
    if (tab === 2) loadKnowledge();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when tab/filter changes
  }, [tab, filterChannel]);

  const openTicket = async (id: string) => {
    const t = await apiService.superAdminGetSupportTicketDetail(id);
    setDetail(t);
    setReply('');
  };

  const sendReply = async () => {
    if (!detail?.id || !reply.trim()) return;
    await apiService.superAdminPostSupportMessage(detail.id, reply.trim());
    setReply('');
    const t = await apiService.superAdminGetSupportTicketDetail(detail.id);
    setDetail(t);
    loadTickets();
  };

  const createArticle = async () => {
    if (!newTitle.trim() || !newBody.trim()) return;
    await apiService.superAdminCreateSupportKnowledge({ title: newTitle, body: newBody });
    setNewTitle('');
    setNewBody('');
    loadKnowledge();
  };

  const apiBase =
    (process.env.REACT_APP_API_URL && process.env.REACT_APP_API_URL.replace(/\/api\/?$/, '')) ||
    (typeof window !== 'undefined' ? window.location.origin : '');

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h5" gutterBottom>Поддержка, дизайн, записи</Typography>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label="Все обращения" />
        <Tab label="Видеозаписи дизайнеров" />
        <Tab label="База знаний (техподдержка)" />
      </Tabs>

      {tab === 0 && (
        <Paper sx={{ p: 2 }}>
          <Box sx={{ mb: 2, display: 'flex', gap: 1 }}>
            <TextField
              select
              size="small"
              label="Канал"
              value={filterChannel}
              onChange={(e) => setFilterChannel(e.target.value)}
              SelectProps={{ native: true }}
              sx={{ minWidth: 160 }}
            >
              <option value="">Все</option>
              <option value="SUPPORT">Техподдержка (клиенты)</option>
              <option value="DESIGNER">Дизайнеры (горячая линия)</option>
              <option value="DESIGNER_SUPERADMIN">Дизайнеры ↔ супер-админы</option>
            </TextField>
            <Button onClick={loadTickets}>Обновить</Button>
          </Box>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Тенант / дизайнер</TableCell>
                <TableCell>Канал</TableCell>
                <TableCell>Статус</TableCell>
                <TableCell>Сообщ.</TableCell>
                <TableCell>Записи</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {tickets.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>
                    {t.channel === 'DESIGNER_SUPERADMIN'
                      ? (t.assignedStaff
                        ? `${t.assignedStaff.firstName} ${t.assignedStaff.lastName}`
                        : '—')
                      : t.tenant?.name}
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={t.channel === 'DESIGNER_SUPERADMIN' ? 'дизайнер ↔ админы' : t.channel}
                    />
                  </TableCell>
                  <TableCell>{t.status}</TableCell>
                  <TableCell>{t._count?.messages}</TableCell>
                  <TableCell>{t._count?.callRecordings}</TableCell>
                  <TableCell><Button size="small" onClick={() => openTicket(t.id)}>Открыть</Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {detail && (
            <Box sx={{ mt: 3 }}>
              <Typography variant="h6">
                Чат #{detail.id?.slice(0, 8)}
                {detail.channel === 'DESIGNER_SUPERADMIN' && detail.assignedStaff && (
                  <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                    (дизайнер: {detail.assignedStaff.firstName} {detail.assignedStaff.lastName})
                  </Typography>
                )}
              </Typography>
              {detail.messages?.map((m: any) => (
                <Box key={m.id} sx={{ my: 1, p: 1, bgcolor: 'action.hover', borderRadius: 1 }}>
                  <Typography variant="caption">{m.authorType}</Typography>
                  <Typography variant="body2">{m.body}</Typography>
                </Box>
              ))}
              <TextField
                fullWidth
                multiline
                minRows={2}
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="Ответ от администратора платформы"
                sx={{ mt: 1 }}
              />
              <Button variant="contained" sx={{ mt: 1 }} onClick={sendReply}>Отправить</Button>
              <Button sx={{ mt: 1, ml: 1 }} onClick={() => setDetail(null)}>Закрыть</Button>
            </Box>
          )}
        </Paper>
      )}

      {tab === 1 && (
        <Paper sx={{ p: 2 }}>
          <Button onClick={loadRecordings} sx={{ mb: 2 }}>Обновить</Button>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Начало</TableCell>
                <TableCell>Истекает</TableCell>
                <TableCell>Кто загрузил</TableCell>
                <TableCell>Файл</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {recordings.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{new Date(r.startedAt).toLocaleString()}</TableCell>
                  <TableCell>{new Date(r.expiresAt).toLocaleString()}</TableCell>
                  <TableCell>
                    {r.recordedBy?.email
                      ?? (r.uploadedByRequesterKind
                        ? `Обращение (${r.uploadedByRequesterKind})`
                        : '—')}
                  </TableCell>
                  <TableCell>
                    <Link href={`${apiBase}/uploads/${r.storagePath}`} target="_blank" rel="noreferrer">
                      Скачать
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Button size="small" color="error" onClick={async () => {
                      await apiService.superAdminDeleteDesignerRecording(r.id);
                      loadRecordings();
                    }}>Удалить</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}

      {tab === 2 && (
        <Paper sx={{ p: 2 }}>
          <Typography variant="subtitle1" gutterBottom>Новая статья</Typography>
          <TextField fullWidth label="Заголовок" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} sx={{ mb: 1 }} />
          <TextField fullWidth multiline minRows={4} label="Текст" value={newBody} onChange={(e) => setNewBody(e.target.value)} />
          <Button sx={{ mt: 1 }} variant="contained" onClick={createArticle}>Сохранить</Button>
          <Typography variant="h6" sx={{ mt: 3 }}>Статьи</Typography>
          {articles.map((a) => (
            <Box key={a.id} sx={{ my: 2, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
              <Typography variant="subtitle1">{a.title}</Typography>
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{a.body}</Typography>
            </Box>
          ))}
        </Paper>
      )}
    </Box>
  );
};

export default SuperAdminSupportHub;
