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
    birthCertificateDataUrl: string | null;
    medicalCertificateDataUrl: string | null;
  } | null>(null);

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

      <Panel title="Договоры и доп. соглашения">
        {contracts.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            Договоры пока не загружены школой
          </Typography>
        ) : (
          contracts.map((c) => (
            <Box
              key={c.id}
              sx={{
                mb: 2,
                pb: 2,
                borderBottom: `1px solid ${colors.divider}`,
                '&:last-child': { borderBottom: 'none', mb: 0, pb: 0 },
              }}
            >
              <Box display="flex" alignItems="center" gap={1}>
                <PictureAsPdf color="error" />
                <Box flex={1} minWidth={0}>
                  <Typography fontWeight={600}>{c.title}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {c.originalName} · {formatSize(c.sizeBytes || 0)}
                  </Typography>
                </Box>
                <IconButton
                  size="small"
                  onClick={async () => {
                    try {
                      const { blob, filename } = await apiService.clientDownloadContract(
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
                  <Download />
                </IconButton>
              </Box>
              {(c.addenda || []).length > 0 && (
                <Box mt={1} pl={2}>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ fontSize: typography.hint }}
                  >
                    Доп. соглашения
                  </Typography>
                  {c.addenda.map((a: any) => (
                    <Box key={a.id} display="flex" alignItems="center" gap={1} mt={0.5}>
                      <Typography variant="body2" sx={{ flex: 1 }} noWrap>
                        {a.title}
                      </Typography>
                      <IconButton
                        size="small"
                        onClick={async () => {
                          try {
                            const { blob, filename } =
                              await apiService.clientDownloadContractAddendum(
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
                    </Box>
                  ))}
                </Box>
              )}
            </Box>
          ))
        )}
      </Panel>

      <Panel title="Личные документы">
        {!personalDocs?.birthCertificate && !personalDocs?.medicalCertificate ? (
          <Typography variant="body2" color="text.secondary">
            Личные документы не загружены
          </Typography>
        ) : (
          <Box display="flex" flexDirection="column" gap={1.5}>
            {personalDocs?.birthCertificate && (
              <Box display="flex" alignItems="center" gap={1}>
                <DescriptionOutlined color="primary" />
                <Box flex={1}>
                  <Typography fontWeight={600}>Свидетельство о рождении</Typography>
                  {personalDocs.birthCertificateNumber && (
                    <Typography variant="caption" color="text.secondary">
                      № {personalDocs.birthCertificateNumber}
                    </Typography>
                  )}
                </Box>
                {personalDocs.birthCertificateDataUrl && (
                  <Link
                    href={personalDocs.birthCertificateDataUrl}
                    target="_blank"
                    rel="noopener"
                    underline="hover"
                  >
                    Открыть
                  </Link>
                )}
              </Box>
            )}
            {personalDocs?.medicalCertificate && (
              <Box display="flex" alignItems="center" gap={1}>
                <DescriptionOutlined color="primary" />
                <Box flex={1}>
                  <Typography fontWeight={600}>Медицинская справка</Typography>
                  {personalDocs.medicalCertificateNumber && (
                    <Typography variant="caption" color="text.secondary">
                      № {personalDocs.medicalCertificateNumber}
                    </Typography>
                  )}
                </Box>
                {personalDocs.medicalCertificateDataUrl && (
                  <Link
                    href={personalDocs.medicalCertificateDataUrl}
                    target="_blank"
                    rel="noopener"
                    underline="hover"
                  >
                    Открыть
                  </Link>
                )}
              </Box>
            )}
          </Box>
        )}
      </Panel>
    </Box>
  );
};

export default ClientDocumentsPanel;
