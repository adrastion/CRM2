/**
 * Обучение: нижняя карточка + переход по разделам.
 * Без затемнения экрана и без обводки (они давали «тёмный UI» и отставание).
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  CircularProgress,
  IconButton,
  LinearProgress,
  Paper,
  Typography,
} from '@mui/material';
import { ArrowBack, ArrowForward, CheckCircle, Close } from '@mui/icons-material';
import { apiService } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { getOnboardingSteps } from '../onboarding/steps';

export interface InteractiveOnboardingProps {
  open: boolean;
  onClose: () => void;
  onComplete: () => void;
  onDecline: () => void;
}

const SETTLE_MS = 200;

function parseOnboardingPath(stepPath: string): { pathname: string; hash: string } {
  const hashIndex = stepPath.indexOf('#');
  if (hashIndex === -1) {
    return { pathname: stepPath, hash: '' };
  }
  return {
    pathname: stepPath.slice(0, hashIndex),
    hash: stepPath.slice(hashIndex),
  };
}

function isOnOnboardingPath(stepPath: string): boolean {
  const { pathname, hash } = parseOnboardingPath(stepPath);
  if (pathname && window.location.pathname !== pathname) {
    return false;
  }
  if (hash && window.location.hash !== hash) {
    return false;
  }
  return true;
}

function sleep(ms: number) {
  return new Promise<void>((r) => window.setTimeout(r, ms));
}

const InteractiveOnboarding: React.FC<InteractiveOnboardingProps> = ({
  open,
  onClose,
  onComplete,
  onDecline,
}) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const steps = useMemo(() => getOnboardingSteps(user?.role || 'OWNER'), [user?.role]);

  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);

  const indexRef = useRef(0);
  const runIdRef = useRef(0);
  const startedRef = useRef(false);

  const step = steps[index];
  const total = steps.length;
  const isFirst = index <= 0;
  const isLast = index >= total - 1;
  const progress = total > 0 ? ((index + 1) / total) * 100 : 0;

  useEffect(() => {
    if (!open) {
      startedRef.current = false;
      runIdRef.current += 1;
      indexRef.current = 0;
      setIndex(0);
      setBusy(false);
      return;
    }
    if (!startedRef.current) {
      startedRef.current = true;
      indexRef.current = 0;
      setIndex(0);
    }
  }, [open]);

  useEffect(() => {
    if (!open || !step) return;

    const runId = ++runIdRef.current;
    let cancelled = false;

    (async () => {
      setBusy(true);
      try {
        if (step.path && !isOnOnboardingPath(step.path)) {
          navigate(step.path);
          await sleep(SETTLE_MS);
        }
      } finally {
        if (!cancelled && runId === runIdRef.current) {
          setBusy(false);
        }
      }
    })();
    
    return () => {
      cancelled = true;
    };
  }, [open, index, step, navigate]);

  const persist = async (declined: boolean) => {
    if (saving) return;
    setSaving(true);
    try {
      await apiService.updateOnboardingStatus(
        declined
          ? { onboardingDeclined: true, hasCompletedOnboarding: false }
          : { hasCompletedOnboarding: true, onboardingDeclined: false }
      );
    } catch (e) {
      console.error('onboarding status', e);
    } finally {
      setSaving(false);
      startedRef.current = false;
      if (declined) {
        onDecline();
        onClose();
          } else {
        onComplete();
      }
    }
  };

  const goNext = () => {
    if (saving) return;
    if (isLast) {
      void persist(false);
      return;
    }
    const next = indexRef.current + 1;
    indexRef.current = next;
    setIndex(next);
  };

  const goBack = () => {
    if (saving || isFirst) return;
    const prev = indexRef.current - 1;
    indexRef.current = prev;
    setIndex(prev);
  };

  if (!open || !step) return null;

  return createPortal(
          <Box
          sx={{
            position: 'fixed',
            left: 0,
            right: 0,
            bottom: 0,
        zIndex: 2000,
        pointerEvents: 'none',
        display: 'flex',
        justifyContent: 'center',
        p: { xs: 1.5, sm: 3 },
        pb: { xs: 'max(12px, env(safe-area-inset-bottom))', sm: 3 },
      }}
      role="dialog"
      aria-modal="false"
      aria-labelledby="onboarding-title"
    >
        <Paper
        elevation={12}
          sx={{
          width: { xs: '100%', sm: 520 },
          maxWidth: '100%',
          maxHeight: { xs: 'min(70vh, 560px)', sm: 'min(75vh, 640px)' },
          display: 'flex',
          flexDirection: 'column',
          pointerEvents: 'auto',
            borderRadius: 3,
          overflow: 'hidden',
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        <LinearProgress
          variant="determinate"
          value={progress}
          sx={{ height: 3, bgcolor: 'rgba(72,128,255,0.12)', flexShrink: 0 }}
        />
        <Box sx={{ p: 2.5, overflow: 'auto', flex: 1, minHeight: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 1 }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="caption" color="text.secondary">
                Шаг {index + 1} из {total}
                {busy ? ' · переход…' : ''}
              </Typography>
              <Typography id="onboarding-title" variant="h6" sx={{ fontWeight: 700, lineHeight: 1.25 }}>
                {step.title}
              </Typography>
              {step.description ? (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                  {step.description}
                </Typography>
              ) : null}
            </Box>
            <IconButton
              size="small"
              aria-label="Пропустить обучение"
              disabled={saving}
              onClick={() => void persist(true)}
            >
              <Close fontSize="small" />
            </IconButton>
          </Box>

          <Box component="ul" sx={{ m: 0, pl: 2.25, mb: 0 }}>
            {step.content.map((line, i) => (
              <Typography component="li" variant="body2" key={`${step.id}-${i}`} sx={{ mb: 0.75 }}>
                {line}
              </Typography>
            ))}
          </Box>
          </Box>

            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
            flexWrap: 'wrap',
            px: 2.5,
            py: 1.5,
            borderTop: '1px solid',
            borderColor: 'divider',
            flexShrink: 0,
            bgcolor: 'background.paper',
          }}
        >
          <Button
            size="small"
            color="inherit"
            disabled={saving}
            onClick={() => void persist(true)}
            sx={{ textTransform: 'none' }}
          >
              Пропустить
            </Button>
          <Box sx={{ flex: 1 }} />
          {busy && <CircularProgress size={18} sx={{ mr: 0.5 }} />}
                <Button
            size="small"
                  startIcon={<ArrowBack />}
            disabled={isFirst || saving}
            onClick={goBack}
            sx={{ textTransform: 'none' }}
                >
                  Назад
                </Button>
              <Button
            size="small"
                variant="contained"
            endIcon={isLast ? <CheckCircle /> : <ArrowForward />}
            disabled={saving}
            onClick={goNext}
            sx={{ textTransform: 'none' }}
          >
            {isLast ? 'Завершить' : 'Далее'}
              </Button>
          </Box>
        </Paper>
    </Box>,
    document.body
  );
};

export default InteractiveOnboarding;
