import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Box, IconButton, Typography } from '@mui/material';
import {
  Cameraswitch,
  Delete,
  KeyboardArrowUp,
  Lock,
  Mic,
  Send,
  Stop,
  Videocam,
} from '@mui/icons-material';
import { colors } from '../../theme/tokens';
import { chatTheme } from './chatTheme';

export type ChatRecordKind = 'voice' | 'video';

type Props = {
  disabled?: boolean;
  /** Скрыть кнопку, когда в композере уже Send. */
  hideTrigger?: boolean;
  overlayHostRef?: React.RefObject<HTMLElement | null>;
  onSend: (file: File, kind: ChatRecordKind, durationMs: number) => void;
  onError?: (message: string) => void;
  /** true во время записи / превью — композер заменяется этой панелью. */
  onBusyChange?: (busy: boolean) => void;
};

const MAX_MS = 5 * 60_000;
const HOLD_MS = 200;
const TAP_MOVE_PX = 10;

function pointIn(el: HTMLElement | null, x: number, y: number, pad = 0) {
  if (!el) return false;
  const r = el.getBoundingClientRect();
  return x >= r.left - pad && x <= r.right + pad && y >= r.top - pad && y <= r.bottom + pad;
}

function formatTenths(ms: number) {
  const tenthsTotal = Math.floor(ms / 100);
  const tenths = tenthsTotal % 10;
  const totalSeconds = Math.floor(tenthsTotal / 10);
  const s = totalSeconds % 60;
  const m = Math.floor(totalSeconds / 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${tenths}`;
}

/**
 * Telegram-like hold-to-record: release = send, ← cancel, ↑ lock → preview.
 */
const ChatVoiceRecorder: React.FC<Props> = ({
  disabled,
  hideTrigger,
  overlayHostRef,
  onSend,
  onError,
  onBusyChange,
}) => {
  const [recordMode, setRecordMode] = useState<ChatRecordKind>('voice');
  const [kind, setKind] = useState<ChatRecordKind | null>(null);
  const [locked, setLocked] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [slideX, setSlideX] = useState(0);
  const [slideY, setSlideY] = useState(0);
  const [willCancel, setWillCancel] = useState(false);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);

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
  const recordModeRef = useRef<ChatRecordKind>('voice');
  const abortStartRef = useRef(false);
  const armedRef = useRef(false);
  const releasePendingRef = useRef(false);
  const holdPointerRef = useRef<number | null>(null);
  const detachGestureRef = useRef<(() => void) | null>(null);
  const recordStreamRef = useRef<MediaStream | null>(null);
  const drawLoopRef = useRef<number | null>(null);
  const offscreenVideoRef = useRef<HTMLVideoElement | null>(null);
  const circleVideoRef = useRef<HTMLVideoElement | null>(null);
  const btnRef = useRef<HTMLDivElement | null>(null);
  const lockRef = useRef<HTMLDivElement | null>(null);
  const camerasRef = useRef<MediaDeviceInfo[]>([]);
  const camIndexRef = useRef(0);
  const flippingRef = useRef(false);

  const busy = Boolean(kind || previewFile);
  useEffect(() => {
    onBusyChange?.(busy);
  }, [busy, onBusyChange]);

  const stopTracks = () => {
    if (drawLoopRef.current != null) {
      cancelAnimationFrame(drawLoopRef.current);
      drawLoopRef.current = null;
    }
    if (offscreenVideoRef.current) {
      offscreenVideoRef.current.pause();
      offscreenVideoRef.current.srcObject = null;
      offscreenVideoRef.current = null;
    }
    recordStreamRef.current?.getTracks().forEach((t) => t.stop());
    recordStreamRef.current = null;
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    mediaStreamRef.current = null;
    if (circleVideoRef.current) circleVideoRef.current.srcObject = null;
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
    setCameras([]);
    camerasRef.current = [];
    clearTick();
  };

  useEffect(() => {
    return () => {
      detachGestureRef.current?.();
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
    if (disabled || kindRef.current || previewFile || abortStartRef.current) return;
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
    } else if (holdPointerRef.current == null) {
      pointerIdRef.current = null;
      lockedRef.current = true;
      setLocked(true);
    }
    cancelRef.current = false;
    setWillCancel(false);
    setSlideX(0);
    setSlideY(0);
    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: next === 'video' ? { facingMode: 'user' } : false,
        });
      } catch (err) {
        if (next !== 'video') throw err;
        stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      }
      if (abortStartRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      mediaStreamRef.current = stream;
      if (next === 'video') {
        const preview = document.createElement('video');
        preview.muted = true;
        preview.playsInline = true;
        preview.srcObject = stream;
        offscreenVideoRef.current = preview;
        await preview.play().catch(() => undefined);
        const node = circleVideoRef.current;
        if (node) {
          node.srcObject = stream;
          void node.play().catch(() => undefined);
        }
        const devices = await navigator.mediaDevices.enumerateDevices();
        const vids = devices.filter((d) => d.kind === 'videoinput');
        camerasRef.current = vids;
        camIndexRef.current = Math.max(
          0,
          vids.findIndex((d) => d.deviceId && d.deviceId === stream.getVideoTracks()[0]?.getSettings().deviceId)
        );
        setCameras(vids);
      }
      if (abortStartRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        stopTracks();
        return;
      }
      chunksRef.current = [];
      const mimeCandidates =
        next === 'video'
          ? ['video/webm;codecs=vp8,opus', 'video/webm;codecs=vp9,opus', 'video/webm']
          : ['audio/webm', 'audio/ogg'];
      const mime =
        mimeCandidates.find((item) => MediaRecorder.isTypeSupported(item)) ||
        (next === 'video' ? 'video/webm' : 'audio/webm');
      mimeRef.current = mime;
      let recorder: MediaRecorder;
      try {
        recorder = new MediaRecorder(stream, { mimeType: mime });
      } catch {
        recorder = new MediaRecorder(stream);
        mimeRef.current = recorder.mimeType || mime;
      }
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data);
      };
      recorder.onstop = () => finishBlob(!lockedRef.current);
      startedAtRef.current = Date.now();
      recorder.start(100);
      kindRef.current = next;
      setKind(next);
      if (releasePendingRef.current && !lockedRef.current) {
        const minMs = next === 'video' ? 900 : 350;
        window.setTimeout(() => {
          if (recorder.state === 'recording') recorder.requestData();
          if (recorder.state !== 'inactive') recorder.stop();
        }, minMs);
      }
      tickRef.current = window.setInterval(() => {
        const ms = Date.now() - startedAtRef.current;
        setElapsedMs(ms);
        if (ms >= MAX_MS) {
          cancelRef.current = false;
          lockedRef.current = false;
          recorder.stop();
        }
      }, 100);
    } catch {
      onError?.('Нет доступа к микрофону/камере');
      stopTracks();
      resetUi();
    }
  };

  useEffect(() => {
    const node = circleVideoRef.current;
    const stream = mediaStreamRef.current;
    if (kind === 'video' && node && stream) {
      node.srcObject = stream;
      void node.play().catch(() => undefined);
    }
  }, [kind, cameras]);

  const flipCamera = async () => {
    const list = camerasRef.current;
    if (list.length < 2 || flippingRef.current || kindRef.current !== 'video') return;
    flippingRef.current = true;
    try {
      const next = (camIndexRef.current + 1) % list.length;
      const fresh = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { deviceId: { exact: list[next].deviceId } },
      });
      const newTrack = fresh.getVideoTracks()[0];
      const stream = mediaStreamRef.current;
      if (!stream || !newTrack) {
        fresh.getTracks().forEach((t) => t.stop());
        return;
      }
      stream.getVideoTracks().forEach((t) => {
        stream.removeTrack(t);
        t.stop();
      });
      stream.addTrack(newTrack);
      camIndexRef.current = next;
      fresh.getAudioTracks().forEach((t) => t.stop());
      if (circleVideoRef.current) circleVideoRef.current.srcObject = stream;
      if (offscreenVideoRef.current) offscreenVideoRef.current.srcObject = stream;
    } catch {
      onError?.('Не удалось переключить камеру');
    } finally {
      flippingRef.current = false;
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
    const progress = Math.min(1, elapsedMs / MAX_MS);
    const ringR = 48;
    const ringC = 2 * Math.PI * ringR;
    const videoOverlay =
      kind === 'video' && overlayHostRef?.current
        ? createPortal(
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                pointerEvents: 'none',
                zIndex: 4,
              }}
            >
              <Box sx={{ position: 'relative', width: 'min(70vw, 280px)', height: 'min(70vw, 280px)' }}>
                <Box
                  component="svg"
                  viewBox="0 0 100 100"
                  sx={{
                    position: 'absolute',
                    inset: -6,
                    width: 'calc(100% + 12px)',
                    height: 'calc(100% + 12px)',
                    transform: 'rotate(-90deg)',
                  }}
                >
                  <circle cx="50" cy="50" r={ringR} fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="1.6" />
                  <circle
                    cx="50"
                    cy="50"
                    r={ringR}
                    fill="none"
                    stroke="#fff"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeDasharray={ringC}
                    strokeDashoffset={ringC * (1 - progress)}
                  />
                </Box>
                <Box
                  component="video"
                  ref={circleVideoRef}
                  muted
                  autoPlay
                  playsInline
                  sx={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    borderRadius: '50%',
                    bgcolor: '#111',
                    transform: 'scaleX(-1)',
                  }}
                />
                {cameras.length > 1 && (
                  <IconButton
                    onClick={() => void flipCamera()}
                    title="Сменить камеру"
                    sx={{
                      pointerEvents: 'auto',
                      position: 'absolute',
                      left: '50%',
                      bottom: 10,
                      transform: 'translateX(-50%)',
                      bgcolor: 'rgba(0,0,0,0.55)',
                      color: '#fff',
                      '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' },
                    }}
                  >
                    <Cameraswitch />
                  </IconButton>
                )}
              </Box>
            </Box>,
            overlayHostRef.current
          )
        : null;

    return (
      <>
        {videoOverlay}
        <Box
          sx={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            gap: 1.25,
            px: 1.5,
            py: 1,
            width: '100%',
            bgcolor: chatTheme.composerBg,
            borderTop: `1px solid ${colors.divider}`,
            userSelect: 'none',
            touchAction: 'none',
          }}
        >
          <Box
            sx={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              bgcolor: chatTheme.recDot,
              flexShrink: 0,
              animation: 'chatRecPulse 1s infinite',
              '@keyframes chatRecPulse': {
                '0%': { opacity: 1 },
                '50%': { opacity: 0.35 },
                '100%': { opacity: 1 },
              },
            }}
          />
          <Typography variant="body2" fontWeight={700} sx={{ minWidth: 58, fontVariantNumeric: 'tabular-nums' }}>
            {formatTenths(elapsedMs)}
          </Typography>
          <Typography
            variant="body2"
            sx={{ color: willCancel ? colors.danger : colors.textHint, flex: 1, textAlign: 'center' }}
            noWrap
          >
            {locked ? 'Запись…' : 'Для отмены отпустите курсор вне поля'}
          </Typography>
          {locked ? (
            <>
              <IconButton size="small" color="error" title="Отменить" onClick={discardLocked}>
                <Delete />
              </IconButton>
              <IconButton
                title="Стоп"
                onClick={stopLocked}
                sx={{
                  bgcolor: chatTheme.recordBtn,
                  color: '#fff',
                  width: 40,
                  height: 40,
                  '&:hover': { bgcolor: colors.primaryDark },
                }}
              >
                <Stop />
              </IconButton>
            </>
          ) : (
            <>
              <Box
                ref={lockRef}
                sx={{
                  position: 'absolute',
                  right: 16,
                  bottom: 'calc(100% + 6px)',
                  width: 36,
                  py: 0.5,
                  borderRadius: 999,
                  bgcolor: chatTheme.lockPillBg,
                  color: '#fff',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  zIndex: 5,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
                }}
              >
                <Lock sx={{ fontSize: 16 }} />
                <KeyboardArrowUp sx={{ fontSize: 16 }} />
              </Box>
              <Box
                ref={btnRef}
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  bgcolor: willCancel ? colors.danger : chatTheme.recordBtn,
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {kind === 'video' ? <Videocam sx={{ fontSize: 22 }} /> : <Mic sx={{ fontSize: 22 }} />}
              </Box>
            </>
          )}
        </Box>
      </>
    );
  }

  if (hideTrigger) return null;

  const videoMode = recordMode === 'video';

  const onTriggerPointerDown = (e: React.PointerEvent) => {
    if (disabled || kindRef.current || previewFile) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    const pointerId = e.pointerId;
    const startX = e.clientX;
    const startY = e.clientY;
    const downAt = Date.now();
    holdPointerRef.current = pointerId;
    abortStartRef.current = false;
    armedRef.current = false;
    releasePendingRef.current = false;
    pointerIdRef.current = pointerId;
    startXRef.current = startX;
    startYRef.current = startY;

    const cleanup = () => {
      window.removeEventListener('pointermove', onMoveWin);
      window.removeEventListener('pointerup', onUpWin);
      window.removeEventListener('pointercancel', onUpWin);
      detachGestureRef.current = null;
    };
    detachGestureRef.current?.();
    detachGestureRef.current = cleanup;

    const onMoveWin = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId || !kindRef.current || lockedRef.current) return;
      const inLock = pointIn(lockRef.current, ev.clientX, ev.clientY, 12);
      if (inLock) {
        lockedRef.current = true;
        setLocked(true);
        setWillCancel(false);
        cancelRef.current = false;
        return;
      }
      if (!btnRef.current) return;
      const outside = !pointIn(btnRef.current, ev.clientX, ev.clientY, 8);
      cancelRef.current = outside;
      setWillCancel(outside);
    };

    let timer = 0;
    const onUpWin = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      window.clearTimeout(timer);
      const held = armedRef.current || Boolean(kindRef.current);
      const moved = Math.hypot(ev.clientX - startX, ev.clientY - startY);
      if (!held) {
        abortStartRef.current = true;
        cleanup();
        holdPointerRef.current = null;
        if (Date.now() - downAt < HOLD_MS && moved < TAP_MOVE_PX) {
          setRecordMode((m) => {
            const next: ChatRecordKind = m === 'voice' ? 'video' : 'voice';
            recordModeRef.current = next;
            return next;
          });
        }
        return;
      }
      if (!kindRef.current) {
        releasePendingRef.current = true;
        cleanup();
        holdPointerRef.current = null;
        return;
      }
      if (lockedRef.current || pointIn(lockRef.current, ev.clientX, ev.clientY, 12)) {
        lockedRef.current = true;
        setLocked(true);
        setWillCancel(false);
        cancelRef.current = false;
        cleanup();
        holdPointerRef.current = null;
        return;
      }
      if (btnRef.current) {
        cancelRef.current = !pointIn(btnRef.current, ev.clientX, ev.clientY, 8);
      }
      cleanup();
      holdPointerRef.current = null;
      if (lockedRef.current) return;
      const rec = mediaRecorderRef.current;
      if (rec && rec.state !== 'inactive') rec.stop();
      else abortStartRef.current = true;
    };

    timer = window.setTimeout(() => {
      armedRef.current = true;
      void start(recordModeRef.current);
    }, HOLD_MS);

    window.addEventListener('pointermove', onMoveWin);
    window.addEventListener('pointerup', onUpWin);
    window.addEventListener('pointercancel', onUpWin);
  };

  return (
    <IconButton
      disabled={disabled}
      title={videoMode ? 'Удерживайте для видеосообщения' : 'Удерживайте для голосового'}
      onPointerDown={onTriggerPointerDown}
      onContextMenu={(ev) => ev.preventDefault()}
      sx={{
        color: colors.textHint,
        touchAction: 'none',
        width: 32,
        height: 32,
        flexShrink: 0,
      }}
    >
      {videoMode ? <Videocam sx={{ fontSize: 20 }} /> : <Mic sx={{ fontSize: 20 }} />}
    </IconButton>
  );
};

export default ChatVoiceRecorder;
