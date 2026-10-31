import React, { useEffect, useState } from 'react';
import { Box, CircularProgress, Link, Typography } from '@mui/material';
import { AttachFile } from '@mui/icons-material';
import { apiService } from '../../services/api';

export type SupportAttachmentMode = 'client' | 'requester' | 'superAdmin' | 'platformStaff';

type Attachment = {
  id: string;
  originalName?: string;
  mimeType?: string;
};

function isImageMime(mime?: string | null, name?: string | null) {
  if (String(mime || '').toLowerCase().startsWith('image/')) return true;
  return /\.(png|jpe?g|gif|webp|bmp|heic|heif)$/i.test(String(name || ''));
}

async function loadAttachmentBlob(
  mode: SupportAttachmentMode,
  id: string
): Promise<{ blob: Blob; filename: string; mimeType: string }> {
  if (mode === 'client') return apiService.clientDownloadSupportAttachmentBlob(id);
  if (mode === 'superAdmin') return apiService.superAdminDownloadSupportAttachmentBlob(id);
  if (mode === 'platformStaff') return apiService.platformStaffDownloadSupportAttachmentBlob(id);
  return apiService.requesterDownloadSupportAttachmentBlob(id);
}

/**
 * Превью вложений техподдержки (как ChatMediaBubble): картинки inline, остальное — ссылка.
 */
const SupportAttachmentBubble: React.FC<{
  mode: SupportAttachmentMode;
  attachment: Attachment;
  /** Цвет ссылки в «своём» пузыре чата */
  linkColor?: string;
}> = ({ mode, attachment, linkColor }) => {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const image = isImageMime(attachment.mimeType, attachment.originalName);

  useEffect(() => {
    if (!image) return undefined;
    let revoked: string | null = null;
    let cancelled = false;
    setLoading(true);
    setError('');
    void (async () => {
      try {
        const { blob, mimeType } = await loadAttachmentBlob(mode, attachment.id);
        if (cancelled) return;
        // Axios иногда отдаёт JSON-ошибку как blob
        if (String(mimeType || blob.type || '').includes('application/json')) {
          throw new Error('not an image');
        }
        const u = URL.createObjectURL(blob);
        revoked = u;
        setUrl(u);
      } catch {
        if (!cancelled) setError('Не удалось загрузить изображение');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [mode, attachment.id, image]);

  const openOrDownload = async () => {
    try {
      const { blob, filename, mimeType } = await loadAttachmentBlob(mode, attachment.id);
      if (String(mimeType || blob.type || '').includes('application/json')) {
        throw new Error('download failed');
      }
      const objectUrl = URL.createObjectURL(blob);
      if (isImageMime(mimeType || blob.type, filename) || mimeType === 'application/pdf') {
        window.open(objectUrl, '_blank', 'noopener,noreferrer');
        window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
      } else {
        const a = document.createElement('a');
        a.href = objectUrl;
        a.download = filename || attachment.originalName || 'file';
        a.click();
        URL.revokeObjectURL(objectUrl);
      }
    } catch {
      setError('Не удалось открыть файл');
    }
  };

  if (image) {
    if (loading && !url) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 1.5 }}>
          <CircularProgress size={20} />
        </Box>
      );
    }
    if (error && !url) {
      return (
        <Typography variant="caption" color="error">
          {error}
        </Typography>
      );
    }
    if (url) {
      return (
        <Box>
          <Box
            component="button"
            type="button"
            onClick={() => void openOrDownload()}
            sx={{
              display: 'block',
              p: 0,
              border: 'none',
              bgcolor: 'transparent',
              cursor: 'pointer',
              textAlign: 'left',
              maxWidth: 280,
            }}
          >
            <Box
              component="img"
              src={url}
              alt={attachment.originalName || 'image'}
              sx={{
                display: 'block',
                maxWidth: '100%',
                maxHeight: 280,
                borderRadius: 1,
                objectFit: 'contain',
                border: '1px solid rgba(0,0,0,0.08)',
              }}
            />
          </Box>
          <Typography
            variant="caption"
            sx={{ mt: 0.35, display: 'block', color: linkColor || 'primary.main', cursor: 'pointer' }}
            onClick={() => void openOrDownload()}
          >
            {attachment.originalName || 'изображение'}
          </Typography>
        </Box>
      );
    }
  }

  return (
    <Box>
      <Link
        component="button"
        type="button"
        onClick={() => void openOrDownload()}
        underline="hover"
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.5,
          fontSize: 12.5,
          color: linkColor || 'primary.main',
          textAlign: 'left',
        }}
      >
        <AttachFile sx={{ fontSize: 15 }} />
        {attachment.originalName || 'файл'}
      </Link>
      {error && (
        <Typography variant="caption" color="error" display="block">
          {error}
        </Typography>
      )}
    </Box>
  );
};

export default SupportAttachmentBubble;
