import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  FormControl,
  IconButton,
  InputLabel,
  List,
  ListItem,
  ListItemSecondaryAction,
  ListItemText,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { Delete, Download, UploadFile } from '@mui/icons-material';
import { apiService } from '../../services/api';
import { TrainerDocument } from '../../types';

export const TRAINER_DOC_KIND_LABELS: Record<string, string> = {
  DIPLOMA: 'Диплом',
  EDUCATION: 'Образование',
  CERTIFICATE: 'Сертификат',
  OTHER: 'Прочее',
};

interface TrainerDocumentsPanelProps {
  trainerId: string;
  initialDocs?: TrainerDocument[];
  onChanged?: (docs: TrainerDocument[]) => void;
}

const TrainerDocumentsPanel: React.FC<TrainerDocumentsPanelProps> = ({
  trainerId,
  initialDocs,
  onChanged,
}) => {
  const [docs, setDocs] = useState<TrainerDocument[]>(initialDocs || []);
  const [kind, setKind] = useState('CERTIFICATE');
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialDocs) setDocs(initialDocs);
  }, [initialDocs]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await apiService.listTrainerDocuments(trainerId);
        if (!cancelled) {
          setDocs(list);
          onChanged?.(list);
        }
      } catch {
        /* keep initial */
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trainerId]);

  const refresh = async () => {
    const list = await apiService.listTrainerDocuments(trainerId);
    setDocs(list);
    onChanged?.(list);
  };

  const handleUpload = async (file: File | null) => {
    if (!file) return;
    try {
      setBusy(true);
      setError('');
      await apiService.uploadTrainerDocument(trainerId, file, {
        kind,
        title: title.trim() || undefined,
      });
      setTitle('');
      if (fileRef.current) fileRef.current.value = '';
      await refresh();
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось загрузить файл');
    } finally {
      setBusy(false);
    }
  };

  const handleDownload = async (doc: TrainerDocument) => {
    try {
      const blob = await apiService.downloadTrainerDocumentBlob(trainerId, doc.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.originalName || doc.title;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось скачать файл');
    }
  };

  const handleDelete = async (doc: TrainerDocument) => {
    if (!window.confirm(`Удалить «${doc.title}»?`)) return;
    try {
      setBusy(true);
      await apiService.deleteTrainerDocument(trainerId, doc.id);
      await refresh();
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось удалить');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box>
      <Typography sx={{ fontWeight: 600, mb: 1 }}>Документы</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        Дипломы, документы об образовании, сертификаты и прочие подтверждения.
      </Typography>
      {error && (
        <Alert severity="error" sx={{ mb: 1 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mb: 1.5 }}>
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>Тип</InputLabel>
          <Select value={kind} label="Тип" onChange={(e) => setKind(e.target.value)}>
            {Object.entries(TRAINER_DOC_KIND_LABELS).map(([k, label]) => (
              <MenuItem key={k} value={k}>
                {label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <TextField
          size="small"
          label="Название"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Необязательно"
          fullWidth
        />
        <Button
          variant="outlined"
          startIcon={<UploadFile />}
          disabled={busy}
          sx={{ textTransform: 'none', whiteSpace: 'nowrap' }}
          onClick={() => fileRef.current?.click()}
        >
          Загрузить
        </Button>
        <input
          ref={fileRef}
          type="file"
          hidden
          accept=".pdf,image/*"
          onChange={(e) => void handleUpload(e.target.files?.[0] || null)}
        />
      </Stack>
      {docs.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          Документов пока нет
        </Typography>
      ) : (
        <List dense disablePadding>
          {docs.map((d) => (
            <ListItem key={d.id} sx={{ px: 0 }}>
              <ListItemText
                primary={d.title}
                secondary={`${TRAINER_DOC_KIND_LABELS[d.kind] || d.kind} · ${d.originalName}`}
              />
              <ListItemSecondaryAction>
                <IconButton edge="end" size="small" onClick={() => void handleDownload(d)} aria-label="Скачать">
                  <Download fontSize="small" />
                </IconButton>
                <IconButton edge="end" size="small" onClick={() => void handleDelete(d)} aria-label="Удалить">
                  <Delete fontSize="small" />
                </IconButton>
              </ListItemSecondaryAction>
            </ListItem>
          ))}
        </List>
      )}
    </Box>
  );
};

export default TrainerDocumentsPanel;
