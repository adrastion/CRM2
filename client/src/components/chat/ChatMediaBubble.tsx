import React, { useEffect, useRef, useState } from 'react';
import { Box, CircularProgress, IconButton, Typography } from '@mui/material';
import { Pause, PlayArrow, VolumeUp } from '@mui/icons-material';
import { apiService } from '../../services/api';
import { colors } from '../../theme/tokens';

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

function formatAudioTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Единый плеер голосовых — как в кабинете школы (не системный &lt;audio controls&gt;). */
const VoicePlayer: React.FC<{ src: string; accent?: string }> = ({
  src,
  accent = colors.primary,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onTime = () => setCurrent(el.currentTime || 0);
    const onMeta = () => setDuration(el.duration || 0);
    const onEnd = () => {
      setPlaying(false);
      setCurrent(0);
    };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    el.addEventListener('timeupdate', onTime);
    el.addEventListener('loadedmetadata', onMeta);
    el.addEventListener('ended', onEnd);
    el.addEventListener('play', onPlay);
    el.addEventListener('pause', onPause);
    return () => {
      el.removeEventListener('timeupdate', onTime);
      el.removeEventListener('loadedmetadata', onMeta);
      el.removeEventListener('ended', onEnd);
      el.removeEventListener('play', onPlay);
      el.removeEventListener('pause', onPause);
    };
  }, [src]);

  const toggle = () => {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) void el.play();
    else el.pause();
  };

  const progress = duration > 0 ? Math.min(1, current / duration) : 0;

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.75,
        minWidth: 200,
        maxWidth: 280,
        py: 0.25,
      }}
    >
      <audio ref={audioRef} src={src} preload="metadata" />
      <IconButton
        size="small"
        onClick={toggle}
        aria-label={playing ? 'Пауза' : 'Слушать'}
        sx={{
          width: 36,
          height: 36,
          bgcolor: accent,
          color: '#fff',
          '&:hover': { bgcolor: accent, filter: 'brightness(0.92)' },
        }}
      >
        {playing ? <Pause sx={{ fontSize: 20 }} /> : <PlayArrow sx={{ fontSize: 22 }} />}
      </IconButton>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box
          component="input"
          type="range"
          min={0}
          max={duration || 0}
          step={0.01}
          value={current}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            const v = Number(e.target.value);
            const el = audioRef.current;
            if (el) el.currentTime = v;
            setCurrent(v);
          }}
          sx={{
            width: '100%',
            height: 4,
            appearance: 'none',
            bgcolor: 'transparent',
            cursor: 'pointer',
            '&::-webkit-slider-runnable-track': {
              height: 4,
              borderRadius: 2,
              background: `linear-gradient(90deg, ${accent} ${progress * 100}%, rgba(32,34,36,0.18) ${progress * 100}%)`,
            },
            '&::-webkit-slider-thumb': {
              appearance: 'none',
              width: 12,
              height: 12,
              borderRadius: '50%',
              bgcolor: accent,
              marginTop: -4,
              boxShadow: '0 0 0 2px #fff',
            },
            '&::-moz-range-track': {
              height: 4,
              borderRadius: 2,
              background: 'rgba(32,34,36,0.18)',
            },
            '&::-moz-range-progress': {
              height: 4,
              borderRadius: 2,
              background: accent,
            },
            '&::-moz-range-thumb': {
              width: 12,
              height: 12,
              border: 'none',
              borderRadius: '50%',
              bgcolor: accent,
            },
          }}
        />
        <Box display="flex" justifyContent="space-between" alignItems="center" mt={0.35}>
          <Typography sx={{ fontSize: 11, color: colors.textHint, lineHeight: 1 }}>
            {formatAudioTime(playing || current > 0 ? current : duration)}
          </Typography>
          <VolumeUp sx={{ fontSize: 14, color: colors.textHint, opacity: 0.7 }} />
        </Box>
      </Box>
    </Box>
  );
};

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

  return <VoicePlayer src={url} />;
};

export default ChatMediaBubble;
