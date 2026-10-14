import React from 'react';
import { Link, LinkProps } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { colors } from '../theme/tokens';

export interface TrainerNameLinkProps {
  trainerId: string;
  name?: string;
  variant?: 'link' | 'inherit' | 'body1' | 'body2';
  sx?: LinkProps['sx'];
  stopPropagation?: boolean;
  /** Открыть карточку на месте (без перехода на /trainers). */
  onOpen?: (trainerId: string) => void;
}

/**
 * Кликабельное имя тренера — по умолчанию deep link `/trainers?trainerId=…`,
 * либо `onOpen` для карточки на текущей странице.
 */
const TrainerNameLink: React.FC<TrainerNameLinkProps> = ({
  trainerId,
  name,
  variant = 'link',
  sx,
  stopPropagation = true,
  onOpen,
}) => {
  const navigate = useNavigate();
  const displayName = name || '—';

  const handleClick = (e: React.MouseEvent) => {
    if (stopPropagation) {
      e.stopPropagation();
      e.preventDefault();
    }
    if (onOpen) {
      onOpen(trainerId);
      return;
    }
    navigate(`/trainers?trainerId=${encodeURIComponent(trainerId)}`);
  };

  const linkVariant = variant === 'link' ? 'body2' : variant;

  return (
    <Link
      component="button"
      type="button"
      variant={linkVariant}
      onClick={handleClick}
      sx={{
        cursor: 'pointer',
        color: colors.primary,
        fontWeight: 500,
        textDecoration: 'none',
        textAlign: 'left',
        border: 'none',
        background: 'none',
        p: 0,
        font: 'inherit',
        '&:hover': {
          textDecoration: 'underline',
        },
        ...sx,
      }}
    >
      {displayName}
    </Link>
  );
};

export default TrainerNameLink;
