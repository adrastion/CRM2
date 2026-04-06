import { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { getWsBaseUrl } from '../utils/getWsBaseUrl';

const ICE: RTCConfiguration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
};

function pickRecorderMime(): string {
  const cands = ['audio/webm;codecs=opus', 'audio/webm'];
  for (const m of cands) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m)) return m;
  }
  return '';
}

export type VoiceCallPhase = 'idle' | 'connecting' | 'active' | 'uploading' | 'error';

export interface WebRtcSignalMessage {
  payload: {
    type: 'offer' | 'answer' | 'ice-candidate';
    sdp?: RTCSessionDescriptionInit;
    candidate?: RTCIceCandidateInit;
  };
  fromRole?: string;
}

export interface UseDesignerVoiceCallOptions {
  ticketId: string | null;
  /** Only DESIGNER tickets use voice */
  channel: string | null;
  mode: 'caller' | 'callee';
  token: string | null;
  /** Start socket / join when true */
  enabled: boolean;
  onRecordingReady: (blob: Blob, startedAt: Date) => Promise<void>;
}

/**
 * Голосовой звонок (WebRTC audio) для тикета DESIGNER + автосохранение записи (только caller).
 * Если дизайнер не в комнате — запись только с микрофона пользователя (без входящего аудио).
 */
export function useDesignerVoiceCall(options: UseDesignerVoiceCallOptions) {
  const { ticketId, channel, mode, token, enabled, onRecordingReady } = options;

  const [phase, setPhase] = useState<VoiceCallPhase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [peerInRoom, setPeerInRoom] = useState(false);
  const [designerOnline, setDesignerOnline] = useState(false);
  const designerOnlineRef = useRef(false);
  useEffect(() => {
    designerOnlineRef.current = designerOnline;
  }, [designerOnline]);

  const ticketIdRef = useRef<string | null>(null);
  ticketIdRef.current = ticketId;

  const socketRef = useRef<Socket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const destRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingStartedRef = useRef(false);
  const callStartedAtRef = useRef<Date | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);

  const onRecordingReadyRef = useRef(onRecordingReady);
  onRecordingReadyRef.current = onRecordingReady;

  const cleanupMedia = useCallback(() => {
    recordingStartedRef.current = false;
    chunksRef.current = [];
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        /* ignore */
      }
    }
    mediaRecorderRef.current = null;
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    destRef.current = null;
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
    }
  }, []);

  const startRecorderOnDest = useCallback((stream: MediaStream) => {
    if (recordingStartedRef.current) return;
    const mime = pickRecorderMime();
    const rec = mime
      ? new MediaRecorder(stream, { mimeType: mime })
      : new MediaRecorder(stream);
    chunksRef.current = [];
    rec.ondataavailable = (e) => {
      if (e.data.size) chunksRef.current.push(e.data);
    };
    rec.start(1000);
    mediaRecorderRef.current = rec;
    recordingStartedRef.current = true;
    setPhase('active');
  }, []);

  const startSoloRecording = useCallback(async () => {
    const local = await navigator.mediaDevices.getUserMedia({ audio: true });
    localStreamRef.current = local;
    const ctx = new AudioContext();
    audioCtxRef.current = ctx;
    const dest = ctx.createMediaStreamDestination();
    destRef.current = dest;
    ctx.createMediaStreamSource(local).connect(dest);
    startRecorderOnDest(dest.stream);
  }, [startRecorderOnDest]);

  const handleCalleeOffer = useCallback(
    async (sdp: RTCSessionDescriptionInit) => {
      if (pcRef.current) return;
      setPhase('connecting');
      const local = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = local;
      const pc = new RTCPeerConnection(ICE);
      pcRef.current = pc;
      local.getTracks().forEach((t) => pc.addTrack(t, local));
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      const s = socketRef.current;
      const tid = ticketId;
      if (s && tid) {
        s.emit('webrtc-signal', {
          ticketId: tid,
          payload: { type: 'answer', sdp: pc.localDescription || answer },
        });
      }
      pc.onicecandidate = (e) => {
        if (e.candidate && s && tid) {
          s.emit('webrtc-signal', {
            ticketId: tid,
            payload: { type: 'ice-candidate', candidate: e.candidate.toJSON() },
          });
        }
      };
      pc.ontrack = (ev) => {
        const stream = ev.streams[0] ?? new MediaStream([ev.track]);
        if (remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = stream;
          remoteAudioRef.current.play().catch(() => {});
        }
      };
      setPhase('active');
    },
    [ticketId]
  );

  const handleCallerSignal = useCallback(
    async (msg: WebRtcSignalMessage) => {
      const { payload } = msg;
      const pc = pcRef.current;
      if (!payload || !pc) return;
      if (payload.type === 'answer' && payload.sdp) {
        await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
        return;
      }
      if (payload.type === 'ice-candidate' && payload.candidate) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
        } catch {
          /* ignore */
        }
      }
    },
    []
  );

  const handleCalleeOfferRef = useRef(handleCalleeOffer);
  handleCalleeOfferRef.current = handleCalleeOffer;
  const handleCallerSignalRef = useRef(handleCallerSignal);
  handleCallerSignalRef.current = handleCallerSignal;
  const modeRef = useRef(mode);
  modeRef.current = mode;

  useEffect(() => {
    const designOk = channel === 'DESIGNER' && enabled && !!token;
    if (!designOk) {
      setDesignerOnline(false);
      setPeerInRoom(false);
      return;
    }

    const socket = io(getWsBaseUrl(), {
      auth: { token },
      transports: ['websocket', 'polling'],
      path: '/socket.io',
    });
    socketRef.current = socket;

    const onSignal = (msg: WebRtcSignalMessage) => {
      if (modeRef.current === 'callee' && msg.payload?.type === 'offer' && msg.payload.sdp) {
        handleCalleeOfferRef.current(msg.payload.sdp).catch((e: any) => {
          setError(e?.message || 'Не удалось принять звонок');
          setPhase('error');
          cleanupMedia();
        });
        return;
      }
      if (modeRef.current === 'caller') {
        handleCallerSignalRef.current(msg).catch(() => {});
      }
    };

    const onRoomState = (p: { hasDesigner: boolean }) => {
      if (p.hasDesigner) setDesignerOnline(true);
    };
    const onPeerJoined = (p: { role: string }) => {
      setPeerInRoom(true);
      if (p.role === 'designer') setDesignerOnline(true);
    };
    const onPeerLeft = (p: { role: string }) => {
      if (p.role === 'designer') setDesignerOnline(false);
      if (p.role === 'requester' || p.role === 'client') setPeerInRoom(false);
    };

    const doJoin = () => {
      const tid = ticketIdRef.current;
      if (!tid) return;
      socket.emit('join-ticket', tid, (r: { ok: boolean; peersInRoom?: number }) => {
        if (r?.ok && (r.peersInRoom ?? 0) > 1) setPeerInRoom(true);
      });
    };

    socket.on('connect', doJoin);
    socket.on('room-state', onRoomState);
    socket.on('peer-joined', onPeerJoined);
    socket.on('peer-left', onPeerLeft);
    socket.on('webrtc-signal', onSignal);
    if (socket.connected) doJoin();

    return () => {
      socket.off('connect', doJoin);
      socket.off('room-state', onRoomState);
      socket.off('peer-joined', onPeerJoined);
      socket.off('peer-left', onPeerLeft);
      socket.off('webrtc-signal', onSignal);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [channel, enabled, token, cleanupMedia]);

  useEffect(() => {
    const s = socketRef.current;
    if (!s?.connected || !ticketId || channel !== 'DESIGNER' || !enabled) return;
    s.emit('join-ticket', ticketId, (r: { ok: boolean; peersInRoom?: number }) => {
      if (r?.ok && (r.peersInRoom ?? 0) > 1) setPeerInRoom(true);
    });
  }, [ticketId, channel, enabled]);

  const endCall = useCallback(async () => {
    if (mode === 'callee') {
      cleanupMedia();
      setPhase('idle');
      setError(null);
      return;
    }

    setPhase('uploading');
    setError(null);
    const started = callStartedAtRef.current || new Date();

    const rec = mediaRecorderRef.current;
    const finishUpload = async (blob: Blob) => {
      try {
        await onRecordingReadyRef.current(blob, started);
      } catch (e: any) {
        setError(e?.message || 'Не удалось сохранить запись');
        setPhase('error');
        cleanupMedia();
        return;
      }
      cleanupMedia();
      callStartedAtRef.current = null;
      setPhase('idle');
    };

    if (rec && rec.state !== 'inactive') {
      await new Promise<void>((resolve) => {
        rec.onstop = () => resolve();
        rec.stop();
      });
      const blob = new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' });
      chunksRef.current = [];
      await finishUpload(blob);
      return;
    }

    cleanupMedia();
    callStartedAtRef.current = null;
    setPhase('idle');
  }, [cleanupMedia, mode]);

  const startCall = useCallback(async () => {
    if (channel !== 'DESIGNER' || phase !== 'idle') return;
    setError(null);
    setPhase('connecting');
    callStartedAtRef.current = new Date();

    const socket = socketRef.current;
    if (!socket || !ticketId) {
      setError('Нет соединения');
      setPhase('error');
      return;
    }

    // Нет дизайнера в комнате — только локальная запись
    if (!designerOnlineRef.current) {
      try {
        await startSoloRecording();
      } catch (e: any) {
        setError(e?.message || 'Нет доступа к микрофону');
        setPhase('error');
        callStartedAtRef.current = null;
      }
      return;
    }

    try {
      const local = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = local;
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const dest = ctx.createMediaStreamDestination();
      destRef.current = dest;
      ctx.createMediaStreamSource(local).connect(dest);

      const pc = new RTCPeerConnection(ICE);
      pcRef.current = pc;
      local.getTracks().forEach((t) => pc.addTrack(t, local));

      pc.ontrack = (ev) => {
        const stream = ev.streams[0] ?? new MediaStream([ev.track]);
        if (remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = stream;
          remoteAudioRef.current.play().catch(() => {});
        }
        try {
          ctx.createMediaStreamSource(stream).connect(dest);
        } catch {
          /* ignore */
        }
        if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
          startRecorderOnDest(dest.stream);
        }
      };

      pc.oniceconnectionstatechange = () => {
        const st = pc.iceConnectionState;
        if (st === 'connected' || st === 'completed') {
          startRecorderOnDest(dest.stream);
        }
        if (st === 'failed' || st === 'disconnected') {
          if (!recordingStartedRef.current) {
            startRecorderOnDest(dest.stream);
          }
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit('webrtc-signal', {
        ticketId,
        payload: { type: 'offer', sdp: pc.localDescription || offer },
      });

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          socket.emit('webrtc-signal', {
            ticketId,
            payload: { type: 'ice-candidate', candidate: e.candidate.toJSON() },
          });
        }
      };

      window.setTimeout(() => {
        if (!recordingStartedRef.current && destRef.current) {
          startRecorderOnDest(destRef.current.stream);
        }
      }, 12000);
    } catch (e: any) {
      setError(e?.message || 'Ошибка звонка');
      setPhase('error');
      cleanupMedia();
      callStartedAtRef.current = null;
    }
  }, [
    channel,
    phase,
    mode,
    ticketId,
    startSoloRecording,
    startRecorderOnDest,
    cleanupMedia,
  ]);

  useEffect(() => {
    return () => {
      cleanupMedia();
    };
  }, [cleanupMedia]);

  return {
    phase,
    error,
    designerOnline,
    peerInRoom,
    remoteAudioRef,
    startCall,
    endCall,
    canStartCall: channel === 'DESIGNER' && phase === 'idle' && mode === 'caller',
    canEndCall: phase === 'active' || phase === 'connecting',
  };
}
