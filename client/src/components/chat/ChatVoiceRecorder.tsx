import React, { useEffect, useRef, useState } from 'react';
import { Box, IconButton, Typography } from '@mui/material';
import { Delete, KeyboardArrowUp, Mic, Send, Stop } from '@mui/icons-material';
import { colors } from '../../theme/tokens';
import { chatTheme } from './chatTheme';

export type ChatRecordKind = 'voice' | 'video';

type Props = {
  disabled?: boolean;
  /** Скрыть кнопку Mic (когда в композере уже Send). */
  hideTrigger?: boolean;
  /** Видеозапись (из меню «скрепки»). */
  startVideoSignal?: number;
  onSend: (file: File, kind: ChatRecordKind, durationMs: number) => void;
  onError?: (message: string) => void;
  /** true во время записи / превью — композер заменяется этой панелью. */
  onBusyChange?: (busy: boolean) => void;
};

const MAX_VOICE_MS = 5 * 60_000;
const CANCEL_DX = -72;
const LOCK_DY = -56;

/**
 * Telegram-like hold-to-record: release = send, ← cancel, ↑ lock → preview.
 */
const ChatVoiceRecorder: React.FC<Props> = ({
  disabled,
  hideTrigger,
  startVideoSignal = 0,
  onSend,
  onError,
  onBusyChange,
}) => {
  const [kind, setKind] = useState<ChatRecordKind | null>(null);
  const [locked, setLocked] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [slideX, setSlideX] = useState(0);
  const [slideY, setSlideY] = useState(0);
  const [willCancel, setWillCancel] = useState(false);

  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const pointerIdRef = useRef<number | null>(null);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const cancelRef = useRef(false);
  const lockedRef = useRef(false);
  const tickRef = useRef<number | null>(null);
  const mimeRef = useRef('audio/webm');
  const kindRef = useRef<ChatRecordKind | null>(null);
  const lastVideoSignal = useRef(0);

  const busy = Boolean(kind || previewFile);
  useEffect(() => {
    onBusyChange?.(busy);
  }, [busy, onBusyChange]);

  const stopTracks = () => {
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    mediaStreamRef.current = null;
  };

  const clearTick = () => {
    if (tickRef.current != null) {
      window.clearInterval(tickRef.current);
      tickRef.current = null;
    }
  };

  const resetUi = () => {
    setKind(null);
    kindRef.current = null;
    setLocked(false);
    lockedRef.current = false;
    setSlideX(0);
    setSlideY(0);
    setWillCancel(false);
    setElapsedMs(0);
    cancelRef.current = false;
    clearTick();
  };

  useEffect(() => {
    return () => {
      stopTracks();
      clearTick();
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finishBlob = (sendNow: boolean) => {
    const mime = mimeRef.current.split(';')[0];
    const blob = new Blob(chunksRef.current, { type: mime });
    const k = kindRef.current || 'voice';
    const file = new File([blob], `chat-${k}.webm`, { type: blob.type });
    const durationMs = Date.now() - startedAtRef.current;
    stopTracks();
    if (cancelRef.current || blob.size < 200) {
      resetUi();
      return;
    }
    if (sendNow && !lockedRef.current) {
      resetUi();
      onSend(file, k, durationMs);
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    const url = URL.createObjectURL(blob);
    setPreviewUrl(url);
    setPreviewFile(file);
    setElapsedMs(durationMs);
    setKind(null);
    kindRef.current = null;
    setLocked(false);
    lockedRef.current = false;
    clearTick();
  };

  const start = async (next: ChatRecordKind, e?: React.PointerEvent) => {
    if (disabled || kindRef.current || previewFile) return;
    if (e) {
      e.preventDefault();
      try {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      pointerIdRef.current = e.pointerId;
      startXRef.current = e.clientX;
      startYRef.current = e.clientY;
    } else {
      pointerIdRef.current = null;
      // video from menu starts locked (preview flow)
      lockedRef.current = true;
      setLocked(true);
    }
    cancelRef.current = false;
    setWillCancel(false);
    setSlideX(0);
    setSlideY(0);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: next === 'video',
      });
      mediaStreamRef.current = stream;
      chunksRef.current = [];
      const mime =
        next === 'video'
          ? MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
            ? 'video/webm;codecs=vp9,opus'
            : 'video/webm'
          : MediaRecorder.isTypeSupported('audio/webm')
            ? 'audio/webm'
            : 'audio/ogg';
      mimeRef.current = mime;
      const recorder = new MediaRecorder(stream, { mimeType: mime });
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data);
      };
      recorder.onstop = () => finishBlob(!lockedRef.current);
      startedAtRef.current = Date.now();
      recorder.start(200);
      kindRef.current = next;
      setKind(next);
      tickRef.current = window.setInterval(() => {
        const ms = Date.now() - startedAtRef.current;
        setElapsedMs(ms);
        if (ms >= MAX_VOICE_MS) {
          cancelRef.current = false;
          lockedRef.current = false;
          recorder.stop();
        }
      }, 200);
    } catch {
      onError?.('Нет доступа к микрофону/камере');
      stopTracks();
      resetUi();
    }
  };

  useEffect(() => {
    if (!startVideoSignal || startVideoSignal === lastVideoSignal.current) return;
    lastVideoSignal.current = startVideoSignal;
    void start('video');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startVideoSignal]);

  const onMove = (e: React.PointerEvent) => {
    if (!kind || lockedRef.current) return;
    if (pointerIdRef.current != null && e.pointerId !== pointerIdRef.current) return;
    const dx = e.clientX - startXRef.current;
    const dy = e.clientY - startYRef.current;
    const clampedX = Math.min(0, dx);
    const clampedY = Math.min(0, dy);
    setSlideX(clampedX);
    setSlideY(clampedY);
    if (clampedX <= CANCEL_DX) {
      cancelRef.current = true;
      setWillCancel(true);
    } else {
      cancelRef.current = false;
      setWillCancel(false);
    }
    if (clampedY <= LOCK_DY) {
      lockedRef.current = true;
      setLocked(true);
      setSlideX(0);
      setSlideY(0);
      setWillCancel(false);
      cancelRef.current = false;
    }
  };

  const onUp = (e: React.PointerEvent) => {
    if (!kind) return;
    if (pointerIdRef.current != null && e.pointerId !== pointerIdRef.current) return;
    if (lockedRef.current) return;
    const rec = mediaRecorderRef.current;
    if (rec && rec.state !== 'inactive') rec.stop();
    else {
      stopTracks();
      resetUi();
    }
  };

  const stopLocked = () => {
    cancelRef.current = false;
    lockedRef.current = true;
    const rec = mediaRecorderRef.current;
    if (rec && rec.state !== 'inactive') rec.stop();
  };

  const discardLocked = () => {
    cancelRef.current = true;
    lockedRef.current = false;
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
      setPreviewFile(null);
      setElapsedMs(0);
      return;
    }
    const rec = mediaRecorderRef.current;
    if (rec && rec.state !== 'inactive') rec.stop();
    else {
      stopTracks();
      resetUi();
    }
  };

  const formatMs = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${String(r).padStart(2, '0')}`;
  };

  if (previewFile && previewUrl) {
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 1.25,
          py: 1,
          width: '100%',
          bgcolor: chatTheme.composerBg,
          borderTop: `1px solid ${colors.divider}`,
        }}
      >
        <IconButton size="small" color="error" title="Удалить" onClick={discardLocked}>
          <Delete />
        </IconButton>
        {previewFile.type.startsWith('video/') ? (
          <Box
            component="video"
            src={previewUrl}
            controls
            sx={{ flex: 1, maxHeight: 96, borderRadius: 2, bgcolor: '#000', minWidth: 0 }}
          />
        ) : (
          <Box component="audio" src={previewUrl} controls sx={{ flex: 1, minWidth: 0 }} />
        )}
        <Typography variant="caption" sx={{ color: colors.textHint, minWidth: 36 }}>
          {formatMs(elapsedMs)}
        </Typography>
        <IconButton
          title="Отправить"
          onClick={() => {
            const file = previewFile;
            const ms = elapsedMs;
            const k: ChatRecordKind = file.type.startsWith('video/') ? 'video' : 'voice';
            URL.revokeObjectURL(previewUrl);
            setPreviewUrl(null);
            setPreviewFile(null);
            setElapsedMs(0);
            onSend(file, k, ms);
          }}
          sx={{
            bgcolor: colors.primary,
            color: '#fff',
            width: 48,
            height: 48,
            '&:hover': { bgcolor: colors.primaryDark },
          }}
        >
          <Send />
        </IconButton>
      </Box>
    );
  }

  if (kind) {
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 1.5,
          py: 1.1,
          width: '100%',
          bgcolor: chatTheme.composerBg,
          borderTop: `1px solid ${colors.divider}`,
          userSelect: 'none',
          touchAction: 'none',
        }}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      >
        <Box
          sx={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            bgcolor: colors.danger,
            flexShrink: 0,
            animation: 'chatRecPulse 1s infinite',
            '@keyframes chatRecPulse': {
              '0%': { opacity: 1 },
              '50%': { opacity: 0.35 },
              '100%': { opacity: 1 },
            },
          }}
        />
        <Typography variant="body2" fontWeight={700} sx={{ minWidth: 40 }}>
          {formatMs(elapsedMs)}
        </Typography>
        <Typography
          variant="body2"
          sx={{
            color: willCancel ? colors.danger : colors.textHint,
            flex: 1,
            transform: `translateX(${Math.max(slideX, -100)}px)`,
            transition: locked ? 'none' : 'color 0.15s',
          }}
          noWrap
        >
          {locked
            ? 'Запись…'
            : willCancel
              ? 'Отпустите — отмена'
              : 'Влево — отмена'}
        </Typography>
        {!locked ? (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              opacity: slideY < -20 ? 1 : 0.55,
              transform: `translateY(${Math.max(slideY, -40)}px)`,
            }}
          >
            <KeyboardArrowUp sx={{ color: colors.textHint, fontSize: 22 }} />
            <Typography variant="caption" sx={{ color: colors.textHint, lineHeight: 1 }}>
              lock
            </Typography>
          </Box>
        ) : (
          <>
            <IconButton size="small" color="error" title="Отменить" onClick={discardLocked}>
              <Delete />
            </IconButton>
            <IconButton
              title="Стоп"
              onClick={stopLocked}
              sx={{
                bgcolor: colors.primary,
                color: '#fff',
                width: 48,
                height: 48,
                '&:hover': { bgcolor: colors.primaryDark },
              }}
            >
              <Stop />
            </IconButton>
          </>
        )}
        {!locked && (
          <Box
            sx={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              bgcolor: willCancel ? colors.danger : colors.primary,
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
            }}
          >
            <Mic />
          </Box>
        )}
      </Box>
    );
  }

  if (hideTrigger) return null;

  return (
    <IconButton
      disabled={disabled}
      title="Удерживайте для голосового"
      onPointerDown={(e) => void start('voice', e)}
      sx={{
        color: colors.textHint,
        touchAction: 'none',
        width: 32,
        height: 32,
        flexShrink: 0,
      }}
    >
      <Mic />
    </IconButton>
  );
};

export default ChatVoiceRecorder;
