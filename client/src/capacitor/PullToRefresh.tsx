import React, { useEffect, useRef, useState } from 'react';
import { Box, CircularProgress } from '@mui/material';
import { isNativeApp } from './platform';
import { isScrollAtTop, runPullRefreshHandlers } from './pullRefresh';
import { colors } from '../theme/tokens';

const THRESHOLD = 72;
const MAX_PULL = 120;

type Props = {
  children: React.ReactNode;
  /** Например чаты — свой скролл/жесты */
  disabled?: boolean;
};

/**
 * Pull-to-refresh только в Capacitor. На вебе рендерит children as-is.
 */
const PullToRefresh: React.FC<Props> = ({ children, disabled }) => {
  const native = isNativeApp();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(0);
  const tracking = useRef(false);
  const pullRef = useRef(0);
  const refreshingRef = useRef(false);

  useEffect(() => {
    refreshingRef.current = refreshing;
  }, [refreshing]);

  useEffect(() => {
    if (!native || disabled) return;
    const root = rootRef.current;
    if (!root) return;

    const onStart = (e: TouchEvent) => {
      if (refreshingRef.current) return;
      if (e.touches.length !== 1) return;
      if (!isScrollAtTop(e.target)) return;
      tracking.current = true;
      startY.current = e.touches[0].clientY;
    };

    const onMove = (e: TouchEvent) => {
      if (!tracking.current || refreshingRef.current) return;
      const dy = e.touches[0].clientY - startY.current;
      if (dy <= 0) {
        pullRef.current = 0;
        setPull(0);
        return;
      }
      if (!isScrollAtTop(e.target)) {
        tracking.current = false;
        pullRef.current = 0;
        setPull(0);
        return;
      }
      const damped = Math.min(MAX_PULL, dy * 0.45);
      pullRef.current = damped;
      setPull(damped);
      if (damped > 8) e.preventDefault();
    };

    const end = async () => {
      if (!tracking.current && pullRef.current <= 0) return;
      tracking.current = false;
      const dist = pullRef.current;
      if (dist < THRESHOLD || refreshingRef.current) {
        setPull(0);
        pullRef.current = 0;
        return;
      }
      setRefreshing(true);
      refreshingRef.current = true;
      setPull(THRESHOLD * 0.7);
      pullRef.current = THRESHOLD * 0.7;
      try {
        await runPullRefreshHandlers();
      } finally {
        setRefreshing(false);
        refreshingRef.current = false;
        setPull(0);
        pullRef.current = 0;
      }
    };

    root.addEventListener('touchstart', onStart, { passive: true });
    root.addEventListener('touchmove', onMove, { passive: false });
    root.addEventListener('touchend', end);
    root.addEventListener('touchcancel', end);
    return () => {
      root.removeEventListener('touchstart', onStart);
      root.removeEventListener('touchmove', onMove);
      root.removeEventListener('touchend', end);
      root.removeEventListener('touchcancel', end);
    };
  }, [native, disabled]);

  if (!native || disabled) {
    return <>{children}</>;
  }

  return (
    <Box
      ref={rootRef}
      sx={{
        position: 'relative',
        flex: 1,
        minHeight: 0,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Box
        aria-hidden
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: Math.max(pull, refreshing ? 40 : 0),
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center',
          pointerEvents: 'none',
          zIndex: 5,
          overflow: 'hidden',
          transition: refreshing || pull === 0 ? 'height 0.2s ease' : undefined,
        }}
      >
        {(pull > 12 || refreshing) && (
          <CircularProgress
            size={22}
            thickness={4}
            sx={{
              mb: 1,
              color: colors.primary,
              opacity: refreshing ? 1 : Math.min(1, pull / THRESHOLD),
            }}
          />
        )}
      </Box>
      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          transform: pull > 0 || refreshing ? `translateY(${pull}px)` : undefined,
          transition: refreshing || pull === 0 ? 'transform 0.2s ease' : undefined,
          willChange: pull > 0 ? 'transform' : undefined,
        }}
      >
        {children}
      </Box>
    </Box>
  );
};

export default PullToRefresh;
