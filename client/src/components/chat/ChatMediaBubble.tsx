import React, { useEffect, useState } from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';
import { apiService } from '../../services/api';

type Mode = 'staff' | 'client' | 'platform';

async function loadBlob(
  mode: Mode,
  threadId: string,
  messageId: string,
  attachmentId: string
): Promise<Blob> {
  if (mode === 'client') {
    return apiService.clientGetChatMediaBlob(threadId, messageId, attachmentId);
  }
  if (mode === 'platform') {
    return apiService.getPlatformChatMediaBlob(threadId, messageId, attachmentId);
  }
  return apiService.getChatMediaBlob(threadId, messageId, attachmentId);
}

const ChatMediaBubble: React.FC<{
  mode: Mode;
  threadId: string;
  messageId: string;
  attachment: {
    id: string;
    kind: string;
    mimeType: string;
    originalName: string;
  };
}> = ({ mode, threadId, messageId, attachment }) => {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let revoked: string | null = null;
    let cancelled = false;
    void (async () => {
      try {
        const blob = await loadBlob(mode, threadId, messageId, attachment.id);
        if (cancelled) return;
        const u = URL.createObjectURL(blob);
        revoked = u;
        setUrl(u);
      } catch {
        if (!cancelled) setError(true);
      }
    })();
    return () => {
      cancelled = true;
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [mode, threadId, messageId, attachment.id]);

  if (error) {
    return (
      <Typography variant="caption" color="error">
        Не удалось загрузить медиа
      </Typography>
    );
  }
  if (!url) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
        <CircularProgress size={22} />
      </Box>
    );
  }

  if (attachment.kind === 'image') {
    return (
      <Box
        component="img"
        src={url}
        alt={attachment.originalName}
        sx={{
          display: 'block',
          maxWidth: '100%',
          maxHeight: 360,
          borderRadius: 1,
          objectFit: 'contain',
        }}
      />
    );
  }

  if (attachment.kind === 'video') {
    return (
      <Box
        component="video"
        src={url}
        controls
        playsInline
        sx={{
          display: 'block',
          maxWidth: '100%',
          maxHeight: 360,
          borderRadius: 1,
          bgcolor: '#000',
        }}
      />
    );
  }

  return (
    <Box component="audio" src={url} controls sx={{ width: '100%', minWidth: 200 }} />
  );
};

export default ChatMediaBubble;
