import React from 'react';
import { Box, Typography } from '@mui/material';
import { PersonOutline } from '@mui/icons-material';
import { colors, radii, typography } from '../../theme/tokens';

export interface AthleteOption {
  id: string;
  firstName: string;
  lastName: string;
}

interface AthleteSwitcherProps {
  athletes: AthleteOption[];
  activeId: string;
  disabled?: boolean;
  onChange: (id: string) => void;
}

/** Переключатель спортсменов (Figma Group 1000001125) — один номер, несколько детей. */
const AthleteSwitcher: React.FC<AthleteSwitcherProps> = ({
  athletes,
  activeId,
  disabled,
  onChange,
}) => {
  if (athletes.length <= 1) return null;

  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'stretch',
        borderRadius: `${radii.cell}px`,
        overflow: 'hidden',
        opacity: disabled ? 0.55 : 1,
        pointerEvents: disabled ? 'none' : 'auto',
      }}
    >
      {athletes.map((athlete, index) => {
        const active = athlete.id === activeId;
        const label = athlete.firstName || athlete.lastName;
        return (
          <Box
            key={athlete.id}
            component={disabled ? 'div' : 'button'}
            type={disabled ? undefined : 'button'}
            onClick={disabled ? undefined : () => onChange(athlete.id)}
            aria-pressed={active}
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 1,
              px: 2.5,
              py: 1.25,
              border: 'none',
              cursor: disabled ? 'default' : 'pointer',
              fontFamily: 'inherit',
              bgcolor: active ? colors.primary : colors.primarySoft,
              color: active ? colors.white : colors.text,
              borderRight: index < athletes.length - 1 ? `1px solid ${colors.white}` : undefined,
            }}
          >
            <PersonOutline sx={{ fontSize: 20, opacity: active ? 1 : 0.7 }} />
            <Typography sx={{ fontSize: typography.label, fontWeight: 600 }}>{label}</Typography>
          </Box>
        );
      })}
    </Box>
  );
};

export default AthleteSwitcher;
