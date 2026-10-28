import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  TextField,
  Typography,
} from '@mui/material';
import {
  BadgeOutlined,
  CloudUploadOutlined,
  DescriptionOutlined,
  Download,
  PictureAsPdf,
} from '@mui/icons-material';
import { apiService } from '../../services/api';
import { colors, radii, typography } from '../../theme/tokens';

interface Props {
  clientId: string;
}

const FORMAT_HINT = 'Поддерживаемые форматы: PDF, JPG, PNG. Максимальный размер файла — 10 МБ.';
const ACCEPT = '.pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png';
const MAX_BYTES = 10 * 1024 * 1024;

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

function validateFile(file: File): string | null {
  const name = file.name.toLowerCase();
  const okMime = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'].includes(file.type);
  const okExt = /\.(pdf|jpe?g|png)$/i.test(name);
  if (!okMime && !okExt) return 'Допустимы только PDF, JPG и PNG';
  if (file.size > MAX_BYTES) return 'Максимальный размер файла — 10 МБ';
  return null;
}

const DocSectionCard: React.FC<{
  title: string;
  description: string;
  children: React.ReactNode;
}> = ({ title, description, children }) => (
  <Box
    sx={{
      bgcolor: colors.card,
      borderRadius: `${radii.panel}px`,
      boxShadow: '0 4px 18px rgba(32, 34, 36, 0.06)',
      border: '1px solid #EEF1F6',
      p: { xs: 2.5, md: 3 },
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      textAlign: 'center',
    }}
  >
    <Typography
      sx={{
        fontWeight: 800,
        fontSize: { xs: 18, md: 20 },
        color: colors.text,
        mb: 0.75,
        alignSelf: 'stretch',
        textAlign: 'left',
      }}
    >
      {title}
    </Typography>
    <Typography
      sx={{
        fontSize: typography.label,
        color: colors.textMuted,
        mb: 2.5,
        alignSelf: 'stretch',
        textAlign: 'left',
        maxWidth: 720,
      }}
    >
      {description}
    </Typography>
    {children}
  </Box>
);

/**
 * Вкладка «Документы» ЛК клиента — макет Reference LK clients.
 */
const ClientDocumentsPanel: React.FC<Props> = ({ clientId }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [uploading, setUploading] = useState(false);
  const [contracts, setContracts] = useState<any[]>([]);
  const [personalDocs, setPersonalDocs] = useState<{
    birthCertificate: boolean;
    birthCertificateNumber: string | null;
    medicalCertificate: boolean;
    medicalCertificateNumber: string | null;
  } | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [kindDialogOpen, setKindDialogOpen] = useState(false);
  const [personalKind, setPersonalKind] = useState<'birth' | 'medical'>('birth');

  const contractInputRef = useRef<HTMLInputElement>(null);
  const personalInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiService.clientListDocuments(clientId);
      setContracts(data.contracts || []);
      setPersonalDocs(data.personalDocs || null);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось загрузить документы');
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    load();
  }, [load]);

  const downloadPersonal = async (kind: 'birth' | 'medical') => {
    setDownloading(kind);
    try {
      const { blob, filename } = await apiService.clientDownloadCertificate(clientId, kind);
      triggerBlobDownload(blob, filename);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось скачать файл');
    } finally {
      setDownloading(null);
    }
  };

  const downloadContract = async (contractId: string, name: string) => {
    setDownloading(contractId);
    try {
      const { blob, filename } = await apiService.clientDownloadContract(clientId, contractId);
      triggerBlobDownload(blob, filename || name);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось скачать договор');
    } finally {
      setDownloading(null);
    }
  };

  const downloadAddendum = async (contractId: string, addendumId: string, name: string) => {
    setDownloading(addendumId);
    try {
      const { blob, filename } = await apiService.clientDownloadContractAddendum(
        clientId,
        contractId,
        addendumId
      );
      triggerBlobDownload(blob, filename || name);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось скачать доп. соглашение');
    } finally {
      setDownloading(null);
    }
  };

  const onContractFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const err = validateFile(file);
    if (err) {
      setError(err);
      return;
    }
    setUploading(true);
    setError('');
    setNotice('');
    try {
      await apiService.clientUploadContract(clientId, file);
      setNotice('Договор загружен');
      await load();
    } catch (ex: any) {
      setError(ex?.response?.data?.error || 'Не удалось загрузить договор');
    } finally {
      setUploading(false);
    }
  };

  const onPersonalFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const err = validateFile(file);
    if (err) {
      setError(err);
      return;
    }
    setUploading(true);
    setError('');
    setNotice('');
    try {
      await apiService.clientUploadCertificate(clientId, personalKind, file);
      setNotice(
        personalKind === 'birth'
          ? 'Свидетельство о рождении загружено'
          : 'Медицинская справка загружена'
      );
      setKindDialogOpen(false);
      await load();
    } catch (ex: any) {
      setError(ex?.response?.data?.error || 'Не удалось загрузить документ');
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" p={4}>
        <CircularProgress />
      </Box>
    );
  }

  const hasPersonal =
    Boolean(personalDocs?.birthCertificate) || Boolean(personalDocs?.medicalCertificate);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 2, md: 2.5 } }}>
      {error && (
        <Typography color="error" variant="body2">
          {error}
        </Typography>
      )}
      {notice && (
        <Typography sx={{ color: colors.success, fontSize: typography.label, fontWeight: 600 }}>
          {notice}
        </Typography>
      )}

      <input
        ref={contractInputRef}
        type="file"
        accept={ACCEPT}
        hidden
        onChange={onContractFile}
      />
      <input
        ref={personalInputRef}
        type="file"
        accept={ACCEPT}
        hidden
        onChange={onPersonalFile}
      />

      <DocSectionCard
        title="Договоры"
        description="Здесь будут храниться договоры, заключенные со школой, а также дополнительные соглашения."
      >
        {contracts.length === 0 ? (
          <>
            <Box
              aria-hidden
              sx={{
                width: 88,
                height: 88,
                borderRadius: '22px',
                bgcolor: '#EAF0FF',
                color: colors.primary,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mb: 2,
                position: 'relative',
              }}
            >
              <DescriptionOutlined sx={{ fontSize: 42 }} />
              <Box
                sx={{
                  position: 'absolute',
                  right: -4,
                  bottom: -4,
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  bgcolor: colors.primary,
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 12px rgba(47, 107, 255, 0.35)',
                }}
              >
                <CloudUploadOutlined sx={{ fontSize: 18 }} />
              </Box>
            </Box>
            <Typography sx={{ fontWeight: 800, fontSize: typography.label, color: colors.text, mb: 0.5 }}>
              Договоры пока не загружены
            </Typography>
            <Typography sx={{ fontSize: typography.hint, color: colors.textMuted, mb: 2.5, maxWidth: 420 }}>
              Загрузите договор, чтобы всегда иметь к нему быстрый доступ.
            </Typography>
            <Button
              variant="contained"
              startIcon={<CloudUploadOutlined />}
              disabled={uploading}
              onClick={() => contractInputRef.current?.click()}
              sx={{
                textTransform: 'none',
                fontWeight: 700,
                borderRadius: `${radii.button}px`,
                bgcolor: colors.primary,
                px: 2.5,
                py: 1.15,
                boxShadow: '0 6px 16px rgba(47, 107, 255, 0.28)',
                '&:hover': { bgcolor: colors.primaryDark },
              }}
            >
              {uploading ? 'Загрузка…' : 'Загрузить договор'}
            </Button>
            <Typography sx={{ mt: 2, fontSize: typography.hint, color: colors.textHint }}>
              {FORMAT_HINT}
            </Typography>
          </>
        ) : (
          <Box sx={{ alignSelf: 'stretch', width: '100%', textAlign: 'left' }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: 2 }}>
              {contracts.map((c) => (
                <Box
                  key={c.id}
                  sx={{
                    border: '1px solid #EEF1F6',
                    borderRadius: `${radii.cell}px`,
                    bgcolor: colors.surface,
                    p: 1.5,
                  }}
                >
                  <Box display="flex" alignItems="center" gap={1}>
                    <PictureAsPdf color="error" fontSize="small" />
                    <Box flex={1} minWidth={0}>
                      <Typography sx={{ fontWeight: 700, fontSize: typography.label }} noWrap>
                        {c.title}
                      </Typography>
                      <Typography sx={{ fontSize: typography.hint, color: colors.textHint }}>
                        {c.originalName}
                        {c.sizeBytes != null ? ` · ${formatSize(c.sizeBytes)}` : ''}
                      </Typography>
                    </Box>
                    <IconButton
                      size="small"
                      disabled={downloading === c.id}
                      onClick={() => downloadContract(c.id, c.originalName || 'contract.pdf')}
                      aria-label="Скачать договор"
                    >
                      <Download fontSize="small" />
                    </IconButton>
                  </Box>
                  {(c.addenda || []).map((a: any) => (
                    <Box key={a.id} display="flex" alignItems="center" gap={1} pl={3} mt={0.75}>
                      <DescriptionOutlined fontSize="small" sx={{ color: colors.textHint }} />
                      <Box flex={1} minWidth={0}>
                        <Typography sx={{ fontSize: typography.hint }} noWrap>
                          {a.title}
                        </Typography>
                      </Box>
                      <IconButton
                        size="small"
                        disabled={downloading === a.id}
                        onClick={() =>
                          downloadAddendum(c.id, a.id, a.originalName || 'addendum.pdf')
                        }
                        aria-label="Скачать доп. соглашение"
                      >
                        <Download fontSize="small" />
                      </IconButton>
                    </Box>
                  ))}
                </Box>
              ))}
            </Box>
            <Button
              variant="contained"
              startIcon={<CloudUploadOutlined />}
              disabled={uploading}
              onClick={() => contractInputRef.current?.click()}
              sx={{
                textTransform: 'none',
                fontWeight: 700,
                borderRadius: `${radii.button}px`,
                bgcolor: colors.primary,
              }}
            >
              Загрузить договор
            </Button>
            <Typography sx={{ mt: 1.5, fontSize: typography.hint, color: colors.textHint }}>
              {FORMAT_HINT}
            </Typography>
          </Box>
        )}
      </DocSectionCard>

      <DocSectionCard
        title="Личные документы"
        description="Здесь будут храниться личные документы спортсмена (паспорт, свидетельство о рождении и другие)."
      >
        {!hasPersonal ? (
          <>
            <Box
              aria-hidden
              sx={{
                width: 88,
                height: 88,
                borderRadius: '22px',
                bgcolor: '#E6F8F3',
                color: colors.success,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mb: 2,
              }}
            >
              <BadgeOutlined sx={{ fontSize: 42 }} />
            </Box>
            <Typography sx={{ fontWeight: 800, fontSize: typography.label, color: colors.text, mb: 0.5 }}>
              Личные документы пока не загружены
            </Typography>
            <Typography sx={{ fontSize: typography.hint, color: colors.textMuted, mb: 2.5, maxWidth: 440 }}>
              Добавьте документы, чтобы мы могли оперативно использовать их при необходимости.
            </Typography>
            <Button
              variant="contained"
              startIcon={<CloudUploadOutlined />}
              disabled={uploading}
              onClick={() => setKindDialogOpen(true)}
              sx={{
                textTransform: 'none',
                fontWeight: 700,
                borderRadius: `${radii.button}px`,
                bgcolor: '#B8F0E3',
                color: '#0B6B5A',
                px: 2.5,
                py: 1.15,
                boxShadow: 'none',
                '&:hover': { bgcolor: '#9FE6D5' },
              }}
            >
              Добавить документ
            </Button>
            <Typography sx={{ mt: 2, fontSize: typography.hint, color: colors.textHint }}>
              {FORMAT_HINT}
            </Typography>
          </>
        ) : (
          <Box sx={{ alignSelf: 'stretch', width: '100%', textAlign: 'left' }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, mb: 2 }}>
              {personalDocs?.birthCertificate && (
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    p: 1.5,
                    borderRadius: `${radii.cell}px`,
                    bgcolor: colors.surface,
                    border: '1px solid #EEF1F6',
                  }}
                >
                  <DescriptionOutlined sx={{ color: colors.primary }} />
                  <Box flex={1}>
                    <Typography sx={{ fontWeight: 700, fontSize: typography.label }}>
                      Свидетельство о рождении
                    </Typography>
                    {personalDocs.birthCertificateNumber && (
                      <Typography sx={{ fontSize: typography.hint, color: colors.textHint }}>
                        № {personalDocs.birthCertificateNumber}
                      </Typography>
                    )}
                  </Box>
                  <IconButton
                    size="small"
                    disabled={downloading === 'birth'}
                    onClick={() => downloadPersonal('birth')}
                    aria-label="Скачать свидетельство"
                  >
                    <Download fontSize="small" />
                  </IconButton>
                </Box>
              )}
              {personalDocs?.medicalCertificate && (
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    p: 1.5,
                    borderRadius: `${radii.cell}px`,
                    bgcolor: colors.surface,
                    border: '1px solid #EEF1F6',
                  }}
                >
                  <DescriptionOutlined sx={{ color: colors.primary }} />
                  <Box flex={1}>
                    <Typography sx={{ fontWeight: 700, fontSize: typography.label }}>
                      Медицинская справка
                    </Typography>
                    {personalDocs.medicalCertificateNumber && (
                      <Typography sx={{ fontSize: typography.hint, color: colors.textHint }}>
                        № {personalDocs.medicalCertificateNumber}
                      </Typography>
                    )}
                  </Box>
                  <IconButton
                    size="small"
                    disabled={downloading === 'medical'}
                    onClick={() => downloadPersonal('medical')}
                    aria-label="Скачать справку"
                  >
                    <Download fontSize="small" />
                  </IconButton>
                </Box>
              )}
            </Box>
            <Button
              variant="contained"
              startIcon={<CloudUploadOutlined />}
              disabled={uploading}
              onClick={() => setKindDialogOpen(true)}
              sx={{
                textTransform: 'none',
                fontWeight: 700,
                borderRadius: `${radii.button}px`,
                bgcolor: '#B8F0E3',
                color: '#0B6B5A',
                boxShadow: 'none',
                '&:hover': { bgcolor: '#9FE6D5' },
              }}
            >
              Добавить документ
            </Button>
            <Typography sx={{ mt: 1.5, fontSize: typography.hint, color: colors.textHint }}>
              {FORMAT_HINT}
            </Typography>
          </Box>
        )}
      </DocSectionCard>

      <Dialog open={kindDialogOpen} onClose={() => setKindDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Добавить документ</DialogTitle>
        <DialogContent>
          <TextField
            select
            fullWidth
            label="Тип документа"
            value={personalKind}
            onChange={(e) => setPersonalKind(e.target.value as 'birth' | 'medical')}
            sx={{ mt: 1 }}
          >
            <MenuItem value="birth">Свидетельство о рождении</MenuItem>
            <MenuItem value="medical">Медицинская справка</MenuItem>
          </TextField>
          <Typography sx={{ mt: 1.5, fontSize: typography.hint, color: colors.textHint }}>
            {FORMAT_HINT}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setKindDialogOpen(false)} sx={{ textTransform: 'none' }}>
            Отмена
          </Button>
          <Button
            variant="contained"
            disabled={uploading}
            onClick={() => personalInputRef.current?.click()}
            sx={{ textTransform: 'none', fontWeight: 700 }}
          >
            Выбрать файл
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ClientDocumentsPanel;
