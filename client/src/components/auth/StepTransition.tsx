import React from 'react';
import { Box } from '@mui/material';
import { motion } from '../../theme/tokens';

interface StepTransitionProps {
  /** Ключ шага: при его смене блок перемонтируется и анимация проигрывается заново. */
  stepKey: string;
  /** forward — новый шаг въезжает справа, back — слева. */
  direction?: 'forward' | 'back';
  children: React.ReactNode;
}

/**
 * Анимированная смена шагов авторизации.
 *
 * Реализация опирается на remount по `key`: React заменяет узел, браузер
 * проигрывает CSS-анимацию появления. Это надёжнее ручного управления
 * фазами и не требует таймеров.
 */
const StepTransition: React.FC<StepTransitionProps> = ({
  stepKey,
  direction = 'forward',
  children,
}) => {
  const from = direction === 'forward' ? 56 : -56;

  return (
    <Box
      key={stepKey}
      sx={{
        '@keyframes authStepIn': {
          from: { opacity: 0, transform: `translateX(${from}px)` },
          to: { opacity: 1, transform: 'translateX(0)' },
        },
        animation: `authStepIn ${motion.stepDuration}ms ${motion.easing} both`,
        willChange: 'opacity, transform',
        '@media (prefers-reduced-motion: reduce)': {
          animation: 'none',
        },
      }}
    >
      {children}
    </Box>
  );
};

export default StepTransition;
