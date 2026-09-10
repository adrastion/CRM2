import React, { useCallback, useEffect, useState } from 'react';
import {
  Box,
  CircularProgress,
  IconButton,
  Link,
  Typography,
} from '@mui/material';
import { Download, PictureAsPdf, DescriptionOutlined } from '@mui/icons-material';
import { apiService } from '../../services/api';
import Panel from '../dashboard/Panel';
import { colors, typography } from '../../theme/tokens';

interface Props {
  clientId: string;
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
 * Вкладка «Документы» личного кабинета: договоры, доп. соглашения, личные файлы.
 */
const ClientDocumentsPanel: React.FC<Props> = ({ clientId }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [contracts, setContracts] = useState<any[]>([]);
  const [personalDocs, setPersonalDocs] = useState<{
    birthCertificate: boolean;
    birthCertificateNumber: string | null;
    medicalCertificate: boolean;
    medicalCertificateNumber: string | null;
  } | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

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

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" p={4}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box display="flex" flexDirection="column" gap={2}>
      {error && (
        <Typography color="error" variant="body2">
          {error}
        </Typography>
      )}

      <Panel title="Договоры">
        {contracts.length === 0 ? (
          <Typography sx={{ fontSize: typography.hint, color: colors.textEmpty }}>
            Договоры пока не загружены школой
          </Typography>
        ) : (
          <Box display="flex" flexDirection="column" gap={1.5}>
            {contracts.map((c) => (
              <Box
                key={c.id}
                sx={{
                  borderBottom: `1px solid ${colors.divider}`,
                  pb: 1.5,
                }}
              >
                <Box display="flex" alignItems="center" gap={1}>
                  <PictureAsPdf color="error" fontSize="small" />
                  <Box flex={1} minWidth={0}>
                    <Typography sx={{ fontWeight: 600, fontSize: typography.label }} noWrap>
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
        )}
      </Panel>

      <Panel title="Личные документы">
        {!personalDocs?.birthCertificate && !personalDocs?.medicalCertificate ? (
          <Typography sx={{ fontSize: typography.hint, color: colors.textEmpty }}>
            Личные документы не загружены
          </Typography>
        ) : (
          <Box display="flex" flexDirection="column" gap={1.5}>
            {personalDocs?.birthCertificate && (
              <Box display="flex" alignItems="center" gap={1}>
                <DescriptionOutlined sx={{ color: colors.primary }} />
                <Box flex={1}>
                  <Typography sx={{ fontWeight: 600, fontSize: typography.label }}>
                    Свидетельство о рождении
                  </Typography>
                  {personalDocs.birthCertificateNumber && (
                    <Typography sx={{ fontSize: typography.hint, color: colors.textHint }}>
                      № {personalDocs.birthCertificateNumber}
                    </Typography>
                  )}
                </Box>
                <Link
                  component="button"
                  type="button"
                  underline="hover"
                  disabled={downloading === 'birth'}
                  onClick={() => downloadPersonal('birth')}
                  sx={{ fontSize: typography.hint }}
                >
                  Скачать
                </Link>
              </Box>
            )}
            {personalDocs?.medicalCertificate && (
              <Box display="flex" alignItems="center" gap={1}>
                <DescriptionOutlined sx={{ color: colors.primary }} />
                <Box flex={1}>
                  <Typography sx={{ fontWeight: 600, fontSize: typography.label }}>
                    Медицинская справка
                  </Typography>
                  {personalDocs.medicalCertificateNumber && (
                    <Typography sx={{ fontSize: typography.hint, color: colors.textHint }}>
                      № {personalDocs.medicalCertificateNumber}
                    </Typography>
                  )}
                </Box>
                <Link
                  component="button"
                  type="button"
                  underline="hover"
                  disabled={downloading === 'medical'}
                  onClick={() => downloadPersonal('medical')}
                  sx={{ fontSize: typography.hint }}
                >
                  Скачать
                </Link>
              </Box>
            )}
          </Box>
        )}
      </Panel>
    </Box>
  );
};

export default ClientDocumentsPanel;
