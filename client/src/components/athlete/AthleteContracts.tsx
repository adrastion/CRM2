import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Collapse,
  IconButton,
  TextField,
  Typography,
} from '@mui/material';
import {
  Add,
  Delete,
  Download,
  ExpandLess,
  ExpandMore,
  PictureAsPdf,
  UploadFile,
} from '@mui/icons-material';
import { apiService } from '../../services/api';
import { colors, radii, typography } from '../../theme/tokens';
import { AthleteCardMode } from './athleteCardTypes';

interface Addendum {
  id: string;
  title: string;
  originalName: string;
  sizeBytes: number;
  signedAt?: string | null;
  createdAt: string;
}

interface Contract {
  id: string;
  title: string;
  originalName: string;
  sizeBytes: number;
  signedAt?: string | null;
  createdAt: string;
  addenda: Addendum[];
}

interface Props {
  clientId: string;
  mode: AthleteCardMode;
  /** Staff: can upload/delete. Client mode is view-only here. */
  canManage: boolean;
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

/**
 * Договоры PDF и доп. соглашения в карточке спортсмена.
 */
const AthleteContracts: React.FC<Props> = ({ clientId, mode, canManage }) => {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [uploading, setUploading] = useState(false);
  const [contractTitle, setContractTitle] = useState('');
  const [addendumTitles, setAddendumTitles] = useState<Record<string, string>>({});
  const contractInputRef = useRef<HTMLInputElement | null>(null);
  const addendumInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const load = useCallback(async () => {
    if (mode !== 'staff') {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await apiService.listClientContracts(clientId);
      setContracts(data || []);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось загрузить договоры');
    } finally {
      setLoading(false);
    }
  }, [clientId, mode]);

  useEffect(() => {
    load();
  }, [load]);

  if (mode !== 'staff') return null;

  const uploadContract = async (file: File) => {
    setUploading(true);
    setError('');
    try {
      await apiService.uploadClientContract(clientId, file, {
        title: contractTitle.trim() || undefined,
      });
      setContractTitle('');
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось загрузить договор');
    } finally {
      setUploading(false);
    }
  };

  const uploadAddendum = async (contractId: string, file: File) => {
    setUploading(true);
    setError('');
    try {
      await apiService.uploadClientContractAddendum(clientId, contractId, file, {
        title: (addendumTitles[contractId] || '').trim() || undefined,
      });
      setAddendumTitles((prev) => ({ ...prev, [contractId]: '' }));
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось загрузить доп. соглашение');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Box
      sx={{
        p: 2,
        bgcolor: colors.surface,
        borderRadius: radii.card,
        border: `1px solid ${colors.divider}`,
      }}
    >
      <Typography sx={{ fontSize: typography.sectionTitle, fontWeight: 700, mb: 1.5 }}>
        Договоры
      </Typography>

      {error && (
        <Typography color="error" variant="body2" sx={{ mb: 1 }}>
          {error}
        </Typography>
      )}

      {canManage && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center', mb: 2 }}>
          <TextField
            size="small"
            label="Название договора"
            value={contractTitle}
            onChange={(e) => setContractTitle(e.target.value)}
            sx={{ minWidth: 200, flex: 1 }}
          />
          <input
            ref={contractInputRef}
            type="file"
            accept="application/pdf,.pdf"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void uploadContract(file);
              e.target.value = '';
            }}
          />
          <Button
            variant="outlined"
            size="small"
            startIcon={uploading ? <CircularProgress size={16} /> : <UploadFile />}
            disabled={uploading}
            onClick={() => contractInputRef.current?.click()}
          >
            PDF договор
          </Button>
        </Box>
      )}

      {loading ? (
        <Box display="flex" justifyContent="center" p={2}>
          <CircularProgress size={24} />
        </Box>
      ) : contracts.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          Договоры не загружены
        </Typography>
      ) : (
        contracts.map((c) => {
          const open = Boolean(expanded[c.id]);
          return (
            <Box
              key={c.id}
              sx={{
                mb: 1.5,
                p: 1.5,
                borderRadius: 1,
                border: `1px solid ${colors.divider}`,
                bgcolor: 'background.paper',
              }}
            >
              <Box display="flex" alignItems="center" gap={1}>
                <PictureAsPdf color="error" fontSize="small" />
                <Box flex={1} minWidth={0}>
                  <Typography fontWeight={600} noWrap>
                    {c.title}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {c.originalName} · {formatSize(c.sizeBytes)}
                    {c.signedAt
                      ? ` · подписан ${new Date(c.signedAt).toLocaleDateString('ru-RU')}`
                      : ''}
                  </Typography>
                </Box>
                <IconButton
                  size="small"
                  onClick={async () => {
                    try {
                      const { blob, filename } = await apiService.downloadClientContract(
                        clientId,
                        c.id
                      );
                      triggerBlobDownload(blob, filename || c.originalName);
                    } catch (e: any) {
                      setError(e?.response?.data?.error || 'Ошибка скачивания');
                    }
                  }}
                  title="Скачать"
                >
                  <Download fontSize="small" />
                </IconButton>
                {canManage && (
                  <IconButton
                    size="small"
                    color="error"
                    onClick={async () => {
                      if (!window.confirm(`Удалить договор «${c.title}» и все доп. соглашения?`)) {
                        return;
                      }
                      try {
                        await apiService.deleteClientContract(clientId, c.id);
                        await load();
                      } catch (e: any) {
                        setError(e?.response?.data?.error || 'Не удалось удалить');
                      }
                    }}
                    title="Удалить"
                  >
                    <Delete fontSize="small" />
                  </IconButton>
                )}
                <IconButton
                  size="small"
                  onClick={() => setExpanded((prev) => ({ ...prev, [c.id]: !open }))}
                >
                  {open ? <ExpandLess /> : <ExpandMore />}
                </IconButton>
              </Box>

              <Collapse in={open}>
                <Box mt={1.5} pl={1}>
                  <Typography variant="caption" color="text.secondary" display="block" mb={1}>
                    Доп. соглашения ({c.addenda?.length || 0})
                  </Typography>
                  {(c.addenda || []).map((a) => (
                    <Box
                      key={a.id}
                      display="flex"
                      alignItems="center"
                      gap={1}
                      sx={{ py: 0.75, borderBottom: `1px solid ${colors.divider}` }}
                    >
                      <Typography variant="body2" sx={{ flex: 1 }} noWrap>
                        {a.title}
                        <Typography component="span" variant="caption" color="text.secondary">
                          {' '}
                          · {formatSize(a.sizeBytes)}
                        </Typography>
                      </Typography>
                      <IconButton
                        size="small"
                        onClick={async () => {
                          try {
                            const { blob, filename } =
                              await apiService.downloadClientContractAddendum(
                                clientId,
                                c.id,
                                a.id
                              );
                            triggerBlobDownload(blob, filename || a.originalName);
                          } catch (e: any) {
                            setError(e?.response?.data?.error || 'Ошибка скачивания');
                          }
                        }}
                      >
                        <Download fontSize="small" />
                      </IconButton>
                      {canManage && (
                        <IconButton
                          size="small"
                          color="error"
                          onClick={async () => {
                            if (!window.confirm(`Удалить «${a.title}»?`)) return;
                            try {
                              await apiService.deleteClientContractAddendum(
                                clientId,
                                c.id,
                                a.id
                              );
                              await load();
                            } catch (e: any) {
                              setError(e?.response?.data?.error || 'Не удалось удалить');
                            }
                          }}
                        >
                          <Delete fontSize="small" />
                        </IconButton>
                      )}
                    </Box>
                  ))}

                  {canManage && (
                    <Box display="flex" gap={1} alignItems="center" mt={1.5} flexWrap="wrap">
                      <TextField
                        size="small"
                        label="Название доп. соглашения"
                        value={addendumTitles[c.id] || ''}
                        onChange={(e) =>
                          setAddendumTitles((prev) => ({ ...prev, [c.id]: e.target.value }))
                        }
                        sx={{ minWidth: 180, flex: 1 }}
                      />
                      <input
                        ref={(el) => {
                          addendumInputRefs.current[c.id] = el;
                        }}
                        type="file"
                        accept="application/pdf,.pdf"
                        hidden
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) void uploadAddendum(c.id, file);
                          e.target.value = '';
                        }}
                      />
                      <Button
                        size="small"
                        startIcon={<Add />}
                        disabled={uploading}
                        onClick={() => addendumInputRefs.current[c.id]?.click()}
                      >
                        PDF доп.
                      </Button>
                    </Box>
                  )}
                </Box>
              </Collapse>
            </Box>
          );
        })
      )}
    </Box>
  );
};

export default AthleteContracts;
